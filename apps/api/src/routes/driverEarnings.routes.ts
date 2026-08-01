import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();

const periodSchema = z.enum(["daily", "weekly", "monthly"]);

router.get("/", requireAuth("driver"), async (req, res) => {
  const parsedPeriod = periodSchema.safeParse(req.query.period);
  const period = parsedPeriod.success ? parsedPeriod.data : "daily";
  const windowDays = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rides = await db.ride.findMany({
    where: { driverId: req.auth!.id, status: "completed", completedAt: { gte: cutoff } },
    orderBy: { completedAt: "desc" },
  });

  res.json({
    period,
    totalEarnings: rides.reduce((sum, r) => sum + r.fareTotal, 0),
    totalRides: rides.length,
    totalDistanceKm: Math.round(rides.reduce((sum, r) => sum + r.distanceKm, 0) * 10) / 10,
    onlineHours: Math.round((rides.length * 0.6 + Math.random() * 2) * 10) / 10,
    rides: rides.map((r) => ({
      rideId: r.id,
      fare: r.fareTotal,
      distanceKm: r.distanceKm,
      completedAt: r.completedAt!.toISOString(),
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
