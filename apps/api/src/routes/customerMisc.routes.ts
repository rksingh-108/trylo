import { Router } from "express";
import { z } from "zod";
import type { VehicleType } from "@trylo/types";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { searchAddressSuggestions } from "../lib/addresses";
import { computeFare, fareRates, loadActivePromoCodes } from "../lib/fare";
import { haversineKm } from "../lib/geo";
import { serializeDriver } from "../lib/serialize";

const router = Router();

router.get("/addresses/search", requireAuth("customer"), async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(await searchAddressSuggestions(q));
});

router.get("/nearby-drivers", requireAuth("customer"), async (req, res) => {
  const vehicleType = req.query.vehicleType;
  const drivers = await db.driver.findMany({
    where: {
      isOnline: true,
      verificationStatus: "verified",
      vehicleType: vehicleType === "bike" || vehicleType === "auto" || vehicleType === "cab" ? vehicleType : undefined,
    },
    take: 10,
  });
  res.json(drivers.map(serializeDriver));
});

function serializeSavedPlace(p: { id: string; label: string; name: string; address: string; lat: number; lng: number }) {
  return { id: p.id, label: p.label, name: p.name, address: p.address, point: { lat: p.lat, lng: p.lng } };
}

router.get("/saved-places", requireAuth("customer"), async (req, res) => {
  const places = await db.savedPlace.findMany({ where: { userId: req.auth!.id } });
  res.json(places.map(serializeSavedPlace));
});

// Saved places had no write path at all before this: the only ones that ever
// existed were the fabricated Home/Work rows seeded on profile save. The rider
// now supplies a real address (chosen in the app's search box), and it's those
// coordinates that get stored and later used as a booking destination.
const savedPlaceSchema = z.object({
  label: z.enum(["home", "work", "other"]),
  name: z.string().min(1).max(60),
  address: z.string().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

router.post("/saved-places", requireAuth("customer"), async (req, res) => {
  const parsed = savedPlaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid saved place" });
    return;
  }
  const { label, name, address, lat, lng } = parsed.data;

  // Home and Work are single-slot: saving a new one replaces the old, which is
  // what a rider expects from "change my home address".
  if (label !== "other") {
    const existing = await db.savedPlace.findFirst({ where: { userId: req.auth!.id, label } });
    if (existing) {
      const updated = await db.savedPlace.update({
        where: { id: existing.id },
        data: { name, address, lat, lng },
      });
      res.json(serializeSavedPlace(updated));
      return;
    }
  }

  const created = await db.savedPlace.create({
    data: { userId: req.auth!.id, label, name, address, lat, lng },
  });
  res.status(201).json(serializeSavedPlace(created));
});

router.delete("/saved-places/:id", requireAuth("customer"), async (req, res) => {
  // Scoped to the caller so one rider can't delete another's saved place.
  const { count } = await db.savedPlace.deleteMany({ where: { id: req.params.id, userId: req.auth!.id } });
  if (count === 0) {
    res.status(404).json({ error: "Saved place not found" });
    return;
  }
  res.status(204).end();
});

router.get("/payment-methods", requireAuth("customer"), async (req, res) => {
  const methods = await db.paymentMethod.findMany({ where: { userId: req.auth!.id } });
  res.json(
    methods.map((m) => ({ id: m.id, type: m.type, label: m.label, detail: m.detail, isDefault: m.isDefault }))
  );
});

const fareEstimateSchema = z.object({
  pickupLat: z.coerce.number(),
  pickupLng: z.coerce.number(),
  dropLat: z.coerce.number(),
  dropLng: z.coerce.number(),
  promoCode: z.string().optional(),
});

router.get("/fares/estimates", requireAuth("customer"), async (req, res) => {
  const parsed = fareEstimateSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fare request" });
    return;
  }
  const { pickupLat, pickupLng, dropLat, dropLng, promoCode } = parsed.data;
  const distanceKm = Math.max(0.8, haversineKm({ lat: pickupLat, lng: pickupLng }, { lat: dropLat, lng: dropLng }));
  const activeCodes = await loadActivePromoCodes(db);
  const promo = promoCode ? activeCodes.find((p) => p.code.toLowerCase() === promoCode.toLowerCase()) : undefined;

  const estimates = (Object.keys(fareRates) as VehicleType[]).map((vehicleType) => {
    const rate = fareRates[vehicleType];
    const { fare, etaMinutes } = computeFare(vehicleType, distanceKm, promo);
    return { vehicleType, fare, etaMinutes, capacity: rate.capacity, label: rate.label, description: rate.description };
  });

  res.json(estimates);
});

router.get("/fares/promo/validate", requireAuth("customer"), async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const activeCodes = await loadActivePromoCodes(db);
  const promo = activeCodes.find((p) => p.code.toLowerCase() === code.toLowerCase());
  res.json(promo ?? null);
});

export default router;
