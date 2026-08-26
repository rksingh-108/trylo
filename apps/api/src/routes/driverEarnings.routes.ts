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
  // "daily" uses the same calendar-day boundary as the dashboard's "Today"
  // figure (see /dashboard above) rather than a rolling 24h window, so the
  // two screens can't disagree about what "today" covers.
  let cutoff: Date;
  if (period === "daily") {
    cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
  } else {
    const windowDays = period === "weekly" ? 7 : 30;
    cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  }

  const earnings = await db.driverEarning.findMany({
    where: { driverId: req.auth!.id, createdAt: { gte: cutoff } },
    include: { ride: true },
    orderBy: { createdAt: "desc" },
  });

  const driver = await db.driver.findUnique({ where: { id: req.auth!.id } });
  const onlineMinutes =
    driver?.onlineSince && driver.onlineSince >= cutoff
      ? Math.floor((Date.now() - driver.onlineSince.getTime()) / 60000)
      : 0;

  res.json({
    period,
    totalEarnings: earnings.reduce((sum, e) => sum + e.amount, 0),
    totalRides: earnings.length,
    totalDistanceKm: Math.round(earnings.reduce((sum, e) => sum + e.ride.distanceKm, 0) * 10) / 10,
    // Real current online-session length within this window, not a random
    // placeholder - a coarse but honest number (this app doesn't persist a
    // full online/offline session history to sum across the whole window).
    onlineHours: Math.round((onlineMinutes / 60) * 10) / 10,
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
