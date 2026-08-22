import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { haversineKm } from "../lib/geo";
import { serializeRide, serializeRideMessage } from "../lib/serialize";
import { emitRequestCleared, emitRideUpdated } from "../realtime/io";
import { recordRideStatus } from "../lib/rideHistory";
import { notifyRideEvent, notifyAllAdmins } from "../lib/notify";
import { isLateCancellation, LATE_CANCELLATION_FEE_INR } from "../lib/cancellationPolicy";

const router = Router();

const ACTIVE_STATUSES = ["requested", "matched", "arriving", "arrived", "in_progress"] as const;
const CANCELLABLE_STATUSES = ["requested", "matched", "arriving"] as const;
/** Ride statuses during which the customer can raise an SOS - mirrors the chat-availability window in realtime/io.ts. */
const SOS_ACTIVE_STATUSES = ["arriving", "arrived", "in_progress"] as const;
/** Don't create a fresh SosAlert (and re-notify admins) for a rapid accidental double-tap on the same ride. */
const SOS_DEDUPE_WINDOW_MS = 2 * 60_000;

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

  const rider = await db.user.findUnique({ where: { id: req.auth!.id } });
  if (rider?.suspended) {
    res.status(403).json({ error: "Your account has been suspended. Contact support." });
    return;
  }

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
  await recordRideStatus(ride.id, "requested");
  await notifyRideEvent({
    rideId: ride.id,
    ownerId: ride.riderId,
    ownerRole: "customer",
    title: "Ride requested",
    body: "Looking for a nearby driver...",
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

// The rider can back out any time before the driver has physically arrived at
// pickup — once the driver is waiting (or the trip has started), it's too
// disruptive to cancel from this endpoint. A "late" cancellation (a driver has
// already accepted - status "arriving"/"arrived") incurs a flat fee, debited
// from the rider's wallet through the same mechanism as the ride-completion
// fare debit in driverRide.routes.ts.
//
// Uses the same compare-and-swap idiom as /rides/:rideId/end: only the request
// that actually flips status to "cancelled" charges the fee. A retry or
// genuinely concurrent duplicate call sees count === 0 and just returns the
// ride's already-decided state. The unique constraint on
// WalletTransaction.rideId is a second, database-level backstop against ever
// double-charging a ride (this can never collide with the ride-fare debit,
// since a ride is either cancelled or completed, never both).
router.post("/:id/cancel", requireAuth("customer"), async (req, res) => {
  const parsed = cancelSchema.safeParse(req.body ?? {});
  const reason = parsed.success ? parsed.data.reason : "Cancelled by rider";

  const existing = await db.ride.findFirst({ where: { id: req.params.id, riderId: req.auth!.id } });
  if (!existing) {
    res.json(null);
    return;
  }

  const { count } = await db.ride.updateMany({
    where: { id: req.params.id, riderId: req.auth!.id, status: { in: [...CANCELLABLE_STATUSES] } },
    data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason, cancelledBy: "customer" },
  });

  if (count === 0) {
    // Re-check the CURRENT state, not the pre-update `existing` snapshot: under a
    // genuine concurrent duplicate cancel, the loser's `existing` would still show
    // the pre-race status (e.g. "arriving") even though the winner already moved it
    // to "cancelled" - checking the fresh read here (rather than the stale one)
    // is what makes this branch correctly idempotent instead of 409-ing the loser.
    const current = await db.ride.findFirst({ where: { id: existing.id }, include: { driver: true, rider: true } });
    if (current?.status === "cancelled") {
      res.json(serializeRide(current));
      return;
    }
    res.status(409).json({ error: "This ride can no longer be cancelled" });
    return;
  }

  const late = isLateCancellation(existing.status);
  const updated = await db.ride.findUniqueOrThrow({ where: { id: existing.id }, include: { driver: true, rider: true } });

  if (late) {
    const rider = await db.user.findUnique({ where: { id: existing.riderId } });
    if (rider && rider.walletBalance >= LATE_CANCELLATION_FEE_INR) {
      try {
        await db.$transaction([
          db.user.update({ where: { id: rider.id }, data: { walletBalance: { decrement: LATE_CANCELLATION_FEE_INR } } }),
          db.walletTransaction.create({
            data: {
              userId: rider.id,
              rideId: existing.id,
              type: "debit",
              category: "cancellation_fee",
              amount: LATE_CANCELLATION_FEE_INR,
              description: "Late cancellation fee",
            },
          }),
        ]);
        await notifyRideEvent({
          rideId: existing.id,
          ownerId: rider.id,
          ownerRole: "customer",
          title: "Cancellation fee charged",
          body: `A ₹${LATE_CANCELLATION_FEE_INR} late cancellation fee was deducted from your wallet.`,
        });
      } catch (err) {
        const isDuplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isDuplicate) throw err;
      }
    }
    // Insufficient balance: the cancellation still goes through - a rider must
    // never be trapped in a ride because they can't afford the fee - it's
    // simply not charged, the same graceful-failure precedent as the
    // ride-fare debit in /rides/:rideId/end.
  }

  await recordRideStatus(updated.id, "cancelled", updated.cancelReason ?? undefined);
  emitRideUpdated(updated.id, serializeRide(updated));
  if (updated.driverId) {
    emitRequestCleared(updated.driverId);
    await notifyRideEvent({
      rideId: updated.id,
      ownerId: updated.driverId,
      ownerRole: "driver",
      title: "Ride cancelled",
      body: "The customer cancelled this ride.",
    });
  }
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

router.get("/:id/messages", requireAuth("customer"), async (req, res) => {
  const ride = await db.ride.findFirst({ where: { id: req.params.id, riderId: req.auth!.id } });
  if (!ride) {
    res.json([]);
    return;
  }
  const messages = await db.rideMessage.findMany({
    where: { rideId: ride.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  res.json(messages.map(serializeRideMessage));
});

const sosSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  note: z.string().max(500).optional(),
});

// In-app emergency alert only - TRYLO has no integration with a real emergency
// dispatch/SMS/telephony provider. This records the event and notifies TRYLO
// admins (see lib/notify.ts); it deliberately does NOT auto-notify the other
// ride participant - in a genuine safety incident, alerting the person who
// may be the source of the problem could make things worse, so only the
// platform's own admins are alerted, exactly as disclosed to the rider in the
// confirmation UI before they trigger it.
router.post("/:id/sos", requireAuth("customer"), async (req, res) => {
  const parsed = sosSchema.safeParse(req.body ?? {});
  const ride = await db.ride.findFirst({ where: { id: req.params.id, riderId: req.auth!.id } });
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }
  if (!SOS_ACTIVE_STATUSES.includes(ride.status as (typeof SOS_ACTIVE_STATUSES)[number])) {
    res.status(409).json({ error: "SOS is only available during an active ride" });
    return;
  }

  // Scoped to this ride AND this triggering role, so a driver's independent SOS
  // shortly after the customer's (or vice versa) on the same ride always creates
  // its own alert - only a rapid repeat tap from the SAME side is deduped.
  const recent = await db.sosAlert.findFirst({
    where: { rideId: ride.id, triggeredBy: "customer", createdAt: { gte: new Date(Date.now() - SOS_DEDUPE_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    res.json({ id: recent.id, createdAt: recent.createdAt.toISOString() });
    return;
  }

  const alert = await db.sosAlert.create({
    data: {
      rideId: ride.id,
      triggeredBy: "customer",
      riderId: ride.riderId,
      driverId: ride.driverId,
      lat: parsed.success ? parsed.data.lat : undefined,
      lng: parsed.success ? parsed.data.lng : undefined,
      note: parsed.success ? parsed.data.note : undefined,
    },
  });
  await notifyAllAdmins(
    "SOS: customer emergency alert",
    `A customer triggered an in-app emergency alert on ride ${ride.id}.`
  );

  res.json({ id: alert.id, createdAt: alert.createdAt.toISOString() });
});

export default router;
