import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { serializeDriver, serializeRide } from "../lib/serialize";
import { emitRideUpdated } from "../realtime/io";

const router = Router();

router.post("/status", requireAuth("driver"), async (req, res) => {
  const parsed = z.object({ isOnline: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const data: Prisma.DriverUpdateInput = {
    isOnline: parsed.data.isOnline,
    onlineSince: parsed.data.isOnline ? new Date() : null,
  };
  const driver = await db.driver.update({ where: { id: req.auth!.id }, data });
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
    where: { driverId: req.auth!.id, status: { in: ["arriving", "in_progress"] } },
    include: { driver: true, rider: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(ride ? serializeRide(ride) : null);
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
  emitRideUpdated(updated.id, serializeRide(updated));
  res.json({ success: true, ride: serializeRide(updated) });
});

router.post("/rides/:rideId/end", requireAuth("driver"), async (req, res) => {
  const ride = await db.ride.findFirst({
    where: { id: req.params.rideId, driverId: req.auth!.id, status: "in_progress" },
  });
  if (!ride) {
    res.json(null);
    return;
  }

  const updated = await db.ride.update({
    where: { id: ride.id },
    data: { status: "completed", completedAt: new Date() },
    include: { driver: true, rider: true },
  });

  await db.driver.update({ where: { id: req.auth!.id }, data: { totalRides: { increment: 1 } } });

  const rider = await db.user.findUnique({ where: { id: updated.riderId } });
  if (rider && rider.walletBalance >= updated.fareTotal) {
    await db.$transaction([
      db.user.update({ where: { id: rider.id }, data: { walletBalance: { decrement: updated.fareTotal } } }),
      db.walletTransaction.create({
        data: {
          userId: rider.id,
          type: "debit",
          category: "ride",
          amount: updated.fareTotal,
          description: `Ride to ${updated.dropAddress}`,
        },
      }),
    ]);
  }

  emitRideUpdated(updated.id, serializeRide(updated));
  res.json(serializeRide(updated));
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
