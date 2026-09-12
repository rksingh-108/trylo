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
    // Tips settled to this driver ride the same way fares do: they land on the
    // DriverEarning row (see customerRide.routes.ts /rate), so totalEarnings
    // and the per-ride list below both include them, and the driver's payout
    // availability (POST /payouts) counts them as withdrawable.
    totalEarnings: earnings.reduce((sum, e) => sum + e.amount + e.tip, 0),
    totalRides: earnings.length,
    totalDistanceKm: Math.round(earnings.reduce((sum, e) => sum + e.ride.distanceKm, 0) * 10) / 10,
    // Real current online-session length within this window, not a random
    // placeholder - a coarse but honest number (this app doesn't persist a
    // full online/offline session history to sum across the whole window).
    onlineHours: Math.round((onlineMinutes / 60) * 10) / 10,
    rides: earnings.map((e) => ({
      rideId: e.rideId,
      fare: e.amount,
      tip: e.tip,
      distanceKm: e.ride.distanceKm,
      completedAt: e.createdAt.toISOString(),
    })),
  });
});

router.get("/payouts", requireAuth("driver"), async (req, res) => {
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

const payoutRequestSchema = z.object({
  amount: z.number().int().positive(),
  bankAccountLast4: z.string().regex(/^\d{4}$/, "Bank account must end in 4 digits"),
});

// Real payout request flow: the driver asks to withdraw part of their settled
// earnings; the request lands as a 'pending' PayoutRecord that an admin
// processes or rejects (see adminPayouts.routes.ts). This replaces the old
// behavior of auto-seeding fake "processed" payouts so the screen had content -
// payouts shown are now always real records, and an empty list honestly means
// no payout has ever been requested.
router.post("/payouts", requireAuth("driver"), async (req, res) => {
  const parsed = payoutRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payout request" });
    return;
  }
  const { amount, bankAccountLast4 } = parsed.data;

  const driver = await db.driver.findUnique({ where: { id: req.auth!.id } });
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  // Available balance = total settled earnings (fare + tips) minus anything
  // already requested (pending or processed) — a driver can't withdraw the
  // same rupee twice, and a rejected request frees its amount back up.
  const [earningsAgg, requestedAgg] = await Promise.all([
    db.driverEarning.aggregate({ where: { driverId: req.auth!.id }, _sum: { amount: true, tip: true } }),
    db.payoutRecord.aggregate({
      where: { driverId: req.auth!.id, status: { in: ["pending", "processed"] } },
      _sum: { amount: true },
    }),
  ]);
  const earned = (earningsAgg._sum.amount ?? 0) + (earningsAgg._sum.tip ?? 0);
  const requested = requestedAgg._sum.amount ?? 0;
  const available = Math.max(0, earned - requested);

  if (amount > available) {
    res.status(400).json({ error: `Only ₹${available} is available to withdraw` });
    return;
  }

  const payout = await db.payoutRecord.create({
    data: { driverId: req.auth!.id, amount, bankAccountLast4, status: "pending" },
  });

  res.status(201).json({
    id: payout.id,
    amount: payout.amount,
    status: payout.status,
    bankAccountLast4: payout.bankAccountLast4,
    initiatedAt: payout.initiatedAt.toISOString(),
    processedAt: payout.processedAt?.toISOString(),
  });
});

export default router;
