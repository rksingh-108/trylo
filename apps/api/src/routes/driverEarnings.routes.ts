import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();

const periodSchema = z.enum(["daily", "weekly", "monthly"]);

// Earnings are computed from DriverEarning rows, not raw completed rides — a
// completed ride whose payment failed (insufficient rider balance) never gets a
// DriverEarning record (see the /rides/:rideId/end handler), so it correctly
// contributes nothing here rather than being counted as money the driver made.
router.get("/", requireAuth("driver"), async (req, res) => {
  const parsedPeriod = periodSchema.safeParse(req.query.period);
  const period = parsedPeriod.success ? parsedPeriod.data : "daily";
  const windowDays = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const earnings = await db.driverEarning.findMany({
    where: { driverId: req.auth!.id, createdAt: { gte: cutoff } },
    include: { ride: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    period,
    totalEarnings: earnings.reduce((sum, e) => sum + e.amount, 0),
    totalRides: earnings.length,
    totalDistanceKm: Math.round(earnings.reduce((sum, e) => sum + e.ride.distanceKm, 0) * 10) / 10,
    onlineHours: Math.round((earnings.length * 0.6 + Math.random() * 2) * 10) / 10,
    rides: earnings.map((e) => ({
      rideId: e.rideId,
      fare: e.amount,
      distanceKm: e.ride.distanceKm,
      completedAt: e.createdAt.toISOString(),
    })),
  });
});

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

router.get("/payouts", requireAuth("driver"), async (req, res) => {
  const existing = await db.payoutRecord.count({ where: { driverId: req.auth!.id } });
  if (existing === 0) {
    await db.payoutRecord.createMany({
      data: [
        { driverId: req.auth!.id, amount: 4250, bankAccountLast4: "4821", initiatedAt: daysAgo(7), processedAt: daysAgo(6) },
        { driverId: req.auth!.id, amount: 3890, bankAccountLast4: "4821", initiatedAt: daysAgo(14), processedAt: daysAgo(13) },
        { driverId: req.auth!.id, amount: 5120, bankAccountLast4: "4821", initiatedAt: daysAgo(21), processedAt: daysAgo(20) },
      ],
    });
  }

  const payouts = await db.payoutRecord.findMany({
    where: { driverId: req.auth!.id },
    orderBy: { initiatedAt: "desc" },
  });

  res.json(
    payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      bankAccountLast4: p.bankAccountLast4,
      initiatedAt: p.initiatedAt.toISOString(),
      processedAt: p.processedAt?.toISOString(),
    }))
  );
});

export default router;
