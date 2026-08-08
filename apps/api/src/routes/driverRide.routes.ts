import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { serializeDriver, serializeRide } from "../lib/serialize";
import { emitDriverLocation, emitRideUpdated } from "../realtime/io";
import { recordRideStatus } from "../lib/rideHistory";
import { haversineKm } from "../lib/geo";

const router = Router();

/** How close (in meters) the driver's GPS needs to be to the pickup point before we auto-mark arrival. */
const ARRIVAL_RADIUS_METERS = 50;

router.post("/status", requireAuth("driver"), async (req, res) => {
  const parsed = z.object({ isOnline: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  if (parsed.data.isOnline) {
    const driver = await db.driver.findUnique({ where: { id: req.auth!.id } });
    if (driver?.suspended) {
      res.status(403).json({ error: "Your account has been suspended. Contact support." });
      return;
    }
  }
  const data: Prisma.DriverUpdateInput = {
    isOnline: parsed.data.isOnline,
    onlineSince: parsed.data.isOnline ? new Date() : null,
  };
  const driver = await db.driver.update({ where: { id: req.auth!.id }, data });
  res.json(serializeDriver(driver));
});

const locationSchema = z.object({ lat: z.number(), lng: z.number() });

router.post("/location", requireAuth("driver"), async (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid location" });
    return;
  }
  const driver = await db.driver.update({
    where: { id: req.auth!.id },
    data: { lat: parsed.data.lat, lng: parsed.data.lng },
  });

  const activeRide = await db.ride.findFirst({
    where: { driverId: driver.id, status: { in: ["arriving", "arrived", "in_progress"] } },
  });

  if (activeRide) {
    emitDriverLocation(activeRide.id, { lat: parsed.data.lat, lng: parsed.data.lng });

    if (activeRide.status === "arriving") {
      const distanceMeters =
        haversineKm(parsed.data, { lat: activeRide.pickupLat, lng: activeRide.pickupLng }) * 1000;
      if (distanceMeters <= ARRIVAL_RADIUS_METERS) {
        const arrived = await db.ride.update({
          where: { id: activeRide.id },
          data: { status: "arrived", arrivedAt: new Date() },
          include: { driver: true, rider: true },
        });
        await recordRideStatus(arrived.id, "arrived");
        emitRideUpdated(arrived.id, serializeRide(arrived));
      }
    }
  }

  res.json(serializeDriver(driver));
});

router.get("/dashboard", requireAuth("driver"), async (req, res) => {
  const driver = await db.driver.findUnique({ where: { id: req.auth!.id } });
  if (!driver) {
    res.json(null);
    return;
  }
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayRides = await db.ride.findMany({
    where: { driverId: driver.id, status: "completed", completedAt: { gte: startOfDay } },
  });
  const onlineMinutes = driver.onlineSince ? Math.floor((Date.now() - driver.onlineSince.getTime()) / 60000) : 0;

  res.json({
    driver: serializeDriver(driver),
    isOnline: driver.isOnline,
    todayEarnings: todayRides.reduce((sum, r) => sum + r.fareTotal, 0),
    todayRides: todayRides.length,
    onlineMinutes,
  });
});

router.get("/requests/incoming", requireAuth("driver"), async (req, res) => {
  const ride = await db.ride.findFirst({
    where: { driverId: req.auth!.id, status: "requested" },
    include: { rider: true },
  });
  if (!ride) {
    res.json(null);
    return;
  }
  if (!ride.offerExpiresAt || ride.offerExpiresAt.getTime() <= Date.now()) {
    await db.ride.update({
      where: { id: ride.id },
      data: { driverId: null, offerExpiresAt: null, excludedDriverIds: { push: req.auth!.id } },
    });
    res.json(null);
    return;
  }
  res.json({ ride: serializeRide(ride), expiresAt: ride.offerExpiresAt.toISOString() });
});

router.post("/requests/:rideId/accept", requireAuth("driver"), async (req, res) => {
  const driver = await db.driver.findUnique({ where: { id: req.auth!.id } });
  if (driver?.suspended) {
    res.status(403).json({ error: "Your account has been suspended. Contact support." });
    return;
  }

  const ride = await db.ride.findFirst({
    where: { id: req.params.rideId, driverId: req.auth!.id, status: "requested" },
  });
  if (!ride) {
    res.json(null);
    return;
  }
  const updated = await db.ride.update({
    where: { id: ride.id },
    data: { status: "arriving", acceptedAt: new Date(), offerExpiresAt: null },
    include: { driver: true, rider: true },
  });
  await db.driver.update({ where: { id: req.auth!.id }, data: { acceptedCount: { increment: 1 } } });
  await recordRideStatus(updated.id, "arriving");
  emitRideUpdated(updated.id, serializeRide(updated));
  res.json(serializeRide(updated));
});

router.post("/requests/:rideId/reject", requireAuth("driver"), async (req, res) => {
  const ride = await db.ride.findFirst({
    where: { id: req.params.rideId, driverId: req.auth!.id, status: "requested" },
  });
  if (ride) {
    await db.ride.update({
      where: { id: ride.id },
      data: { driverId: null, offerExpiresAt: null, excludedDriverIds: { push: req.auth!.id } },
    });
  }
  res.status(204).end();
});

router.get("/rides/active", requireAuth("driver"), async (req, res) => {
  const ride = await db.ride.findFirst({
    where: { driverId: req.auth!.id, status: { in: ["arriving", "arrived", "in_progress"] } },
    include: { driver: true, rider: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(ride ? serializeRide(ride) : null);
});

const driverCancelSchema = z.object({ reason: z.string().default("Cancelled by driver") });

// The driver can back out any time after accepting but before the trip has
// actually started (verified OTP) — once in_progress, they must complete the
// trip rather than cancel it here.
router.post("/rides/:rideId/cancel", requireAuth("driver"), async (req, res) => {
  const parsed = driverCancelSchema.safeParse(req.body ?? {});
  const ride = await db.ride.findFirst({ where: { id: req.params.rideId, driverId: req.auth!.id } });
  if (!ride) {
    res.json(null);
    return;
  }
  if (ride.status !== "arriving" && ride.status !== "arrived") {
    res.status(409).json({ error: "This ride can no longer be cancelled" });
    return;
  }

  const updated = await db.ride.update({
    where: { id: ride.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: parsed.success ? parsed.data.reason : "Cancelled by driver",
      cancelledBy: "driver",
    },
    include: { driver: true, rider: true },
  });
  await recordRideStatus(updated.id, "cancelled", updated.cancelReason ?? undefined);

  emitRideUpdated(updated.id, serializeRide(updated));
  res.json(serializeRide(updated));
});

const verifyOtpSchema = z.object({ otp: z.string() });

router.post("/rides/:rideId/verify-otp", requireAuth("driver"), async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }
  const ride = await db.ride.findFirst({
    where: { id: req.params.rideId, driverId: req.auth!.id },
    include: { driver: true, rider: true },
  });
  if (!ride) {
    res.json({ success: false, ride: null });
    return;
  }
  if (parsed.data.otp !== ride.otp) {
    res.json({ success: false, ride: serializeRide(ride) });
    return;
  }

  const updated = await db.ride.update({
    where: { id: ride.id },
    data: { status: "in_progress", startedAt: new Date() },
    include: { driver: true, rider: true },
  });
  await recordRideStatus(updated.id, "in_progress");
  emitRideUpdated(updated.id, serializeRide(updated));
  res.json({ success: true, ride: serializeRide(updated) });
});

const rideWithRelations = { driver: true, rider: true } satisfies Prisma.RideInclude;

// Completion + payment are gated by a single atomic UPDATE guarded on the ride's
// current status, not a read-then-write: an `updateMany` conditioned on
// `status: "in_progress"` is a compare-and-swap at the database level (Postgres
// locks the matched row and rechecks the WHERE predicate before committing), so
// only the request that actually wins the transition proceeds to process payment.
// Any other call for this ride — a client retry, a double-tap, or a genuinely
// concurrent duplicate request — sees `count === 0` and just returns the ride's
// current (already-decided) state instead of reprocessing payment. The unique
// constraints on `WalletTransaction.rideId` and `DriverEarning.rideId` are a
// second, database-level backstop against ever double-crediting a ride.
router.post("/rides/:rideId/end", requireAuth("driver"), async (req, res) => {
  const { count } = await db.ride.updateMany({
    where: { id: req.params.rideId, driverId: req.auth!.id, status: "in_progress" },
    data: { status: "completed", completedAt: new Date() },
  });

  if (count === 0) {
    const existing = await db.ride.findFirst({
      where: { id: req.params.rideId, driverId: req.auth!.id },
      include: rideWithRelations,
    });
    res.json(existing ? serializeRide(existing) : null);
    return;
  }

  const ride = await db.ride.findUniqueOrThrow({
    where: { id: req.params.rideId },
    include: rideWithRelations,
  });

  await db.driver.update({
    where: { id: req.auth!.id },
    data: { totalRides: { increment: 1 }, lastRideEndedAt: new Date() },
  });
  await recordRideStatus(ride.id, "completed");

  const rider = await db.user.findUnique({ where: { id: ride.riderId } });
  const sufficientBalance = Boolean(rider) && rider!.walletBalance >= ride.fareTotal;

  let finalRide = ride;
  if (sufficientBalance) {
    try {
      const [, , , updatedRide] = await db.$transaction([
        db.user.update({ where: { id: rider!.id }, data: { walletBalance: { decrement: ride.fareTotal } } }),
        db.walletTransaction.create({
          data: {
            userId: rider!.id,
            rideId: ride.id,
            type: "debit",
            category: "ride",
            amount: ride.fareTotal,
            description: `Ride to ${ride.dropAddress}`,
          },
        }),
        db.driverEarning.create({
          data: { driverId: req.auth!.id, rideId: ride.id, amount: ride.fareTotal },
        }),
        db.ride.update({
          where: { id: ride.id },
          data: { paymentStatus: "paid" },
          include: rideWithRelations,
        }),
      ]);
      finalRide = updatedRide;
    } catch (err) {
      // P2002 = unique constraint violation on rideId — another request already
      // processed this ride's payment (the race-safety-net mentioned above).
      // Anything else is a genuine unexpected error and should surface as one.
      const isDuplicatePayment = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isDuplicatePayment) throw err;
      finalRide = await db.ride.findUniqueOrThrow({ where: { id: ride.id }, include: rideWithRelations });
    }
  } else {
    finalRide = await db.ride.update({
      where: { id: ride.id },
      data: { paymentStatus: "failed" },
      include: rideWithRelations,
    });
  }

  emitRideUpdated(finalRide.id, serializeRide(finalRide));
  res.json(serializeRide(finalRide));
});

router.get("/rides/history", requireAuth("driver"), async (req, res) => {
  const rides = await db.ride.findMany({
    where: { driverId: req.auth!.id, status: "completed" },
    include: { driver: true, rider: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(rides.map(serializeRide));
});

export default router;
