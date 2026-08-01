import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { haversineKm } from "../lib/geo";
import { serializeRide } from "../lib/serialize";
import { emitRequestCleared, emitRideUpdated } from "../realtime/io";

const router = Router();

const ACTIVE_STATUSES = ["requested", "matched", "arriving", "in_progress"] as const;

const rideLocationSchema = z.object({
  address: z.string(),
  point: z.object({ lat: z.number(), lng: z.number() }),
});

const fareBreakdownSchema = z.object({
  base: z.number().nonnegative(),
  distance: z.number().nonnegative(),
  time: z.number().nonnegative(),
  surge: z.number().nonnegative(),
  promoDiscount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: z.literal("INR"),
});

const createRideSchema = z.object({
  pickup: rideLocationSchema,
  drop: rideLocationSchema,
  vehicleType: z.enum(["bike", "auto", "cab"]),
  fare: fareBreakdownSchema,
});

router.post("/", requireAuth("customer"), async (req, res) => {
  const parsed = createRideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ride request" });
    return;
  }
  const { pickup, drop, vehicleType, fare } = parsed.data;

  const existingActive = await db.ride.findFirst({
    where: { riderId: req.auth!.id, status: { in: [...ACTIVE_STATUSES] } },
  });
  if (existingActive) {
    res.status(409).json({ error: "You already have an active ride" });
    return;
  }

  const distanceKm = Math.max(0.8, haversineKm(pickup.point, drop.point));
  const durationMin = Math.max(3, Math.round((distanceKm / 24) * 60));
  const otp = String(Math.floor(1000 + Math.random() * 8999));

  const ride = await db.ride.create({
    data: {
      status: "requested",
      vehicleType,
      pickupAddress: pickup.address,
      pickupLat: pickup.point.lat,
      pickupLng: pickup.point.lng,
      dropAddress: drop.address,
      dropLat: drop.point.lat,
      dropLng: drop.point.lng,
      riderId: req.auth!.id,
      otp,
      fareBase: fare.base,
      fareDistance: fare.distance,
      fareTime: fare.time,
      fareSurge: fare.surge,
      farePromoDiscount: fare.promoDiscount,
      fareTotal: fare.total,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMin,
    },
    include: { driver: true, rider: true },
  });

  res.json(serializeRide(ride));
});

router.get("/active", requireAuth("customer"), async (req, res) => {
  const ride = await db.ride.findFirst({
    where: { riderId: req.auth!.id, status: { in: [...ACTIVE_STATUSES] } },
    include: { driver: true, rider: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(ride ? serializeRide(ride) : null);
});

router.get("/history", requireAuth("customer"), async (req, res) => {
  const rides = await db.ride.findMany({
    where: { riderId: req.auth!.id, status: { in: ["completed", "cancelled"] } },
    include: { driver: true, rider: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(rides.map(serializeRide));
});

router.get("/history/:id", requireAuth("customer"), async (req, res) => {
  const ride = await db.ride.findFirst({
    where: { id: req.params.id, riderId: req.auth!.id },
    include: { driver: true, rider: true },
  });
  res.json(ride ? serializeRide(ride) : null);
});

router.get("/:id/status", requireAuth("customer"), async (req, res) => {
  const ride = await db.ride.findFirst({
    where: { id: req.params.id, riderId: req.auth!.id },
    include: { driver: true, rider: true },
  });
  res.json(ride ? serializeRide(ride) : null);
});

const cancelSchema = z.object({ reason: z.string().default("Cancelled by rider") });

router.post("/:id/cancel", requireAuth("customer"), async (req, res) => {
  const parsed = cancelSchema.safeParse(req.body ?? {});
  const ride = await db.ride.findFirst({ where: { id: req.params.id, riderId: req.auth!.id } });
  if (!ride) {
    res.json(null);
    return;
  }

  const updated = await db.ride.update({
    where: { id: ride.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: parsed.success ? parsed.data.reason : "Cancelled by rider",
    },
    include: { driver: true, rider: true },
  });

  emitRideUpdated(updated.id, serializeRide(updated));
  if (updated.driverId) emitRequestCleared(updated.driverId);
  res.json(serializeRide(updated));
});

const rateSchema = z.object({ rating: z.number().min(1).max(5), tip: z.number().min(0).default(0) });

router.post("/:id/rate", requireAuth("customer"), async (req, res) => {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid rating" });
    return;
  }
  const ride = await db.ride.findFirst({ where: { id: req.params.id, riderId: req.auth!.id } });
  if (!ride) {
    res.json(null);
    return;
  }

  const updated = await db.ride.update({
    where: { id: ride.id },
    data: { rating: parsed.data.rating, tip: parsed.data.tip },
    include: { driver: true, rider: true },
  });

  if (updated.driverId) {
    const ratedRides = await db.ride.findMany({
      where: { driverId: updated.driverId, rating: { not: null } },
      select: { rating: true },
    });
    const avg = ratedRides.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratedRides.length;
    await db.driver.update({ where: { id: updated.driverId }, data: { rating: Math.round(avg * 10) / 10 } });
  }

  res.json(serializeRide(updated));
});

export default router;
