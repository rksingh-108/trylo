import { Router } from "express";
import { z } from "zod";
import type { VehicleType } from "@trylo/types";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { searchAddressSuggestions } from "../lib/addresses";
import { computeFare, fareRates, promoCodes } from "../lib/fare";
import { haversineKm } from "../lib/geo";
import { serializeDriver } from "../lib/serialize";

const router = Router();

router.get("/addresses/search", requireAuth("customer"), (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(searchAddressSuggestions(q));
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

router.get("/saved-places", requireAuth("customer"), async (req, res) => {
  const places = await db.savedPlace.findMany({ where: { userId: req.auth!.id } });
  res.json(
    places.map((p) => ({
      id: p.id,
      label: p.label,
      name: p.name,
      address: p.address,
      point: { lat: p.lat, lng: p.lng },
    }))
  );
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

router.get("/fares/estimates", requireAuth("customer"), (req, res) => {
  const parsed = fareEstimateSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fare request" });
    return;
  }
  const { pickupLat, pickupLng, dropLat, dropLng, promoCode } = parsed.data;
  const distanceKm = Math.max(0.8, haversineKm({ lat: pickupLat, lng: pickupLng }, { lat: dropLat, lng: dropLng }));
  const promo = promoCode ? promoCodes.find((p) => p.code.toLowerCase() === promoCode.toLowerCase()) : undefined;

  const estimates = (Object.keys(fareRates) as VehicleType[]).map((vehicleType) => {
    const rate = fareRates[vehicleType];
    const { fare, etaMinutes } = computeFare(vehicleType, distanceKm, promo);
    return { vehicleType, fare, etaMinutes, capacity: rate.capacity, label: rate.label, description: rate.description };
  });

  res.json(estimates);
});

router.get("/fares/promo/validate", requireAuth("customer"), (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const promo = promoCodes.find((p) => p.code.toLowerCase() === code.toLowerCase());
  res.json(promo ?? null);
});

export default router;
