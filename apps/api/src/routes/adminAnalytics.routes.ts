import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { computeCommission } from "../lib/commission";

const router = Router();

const periodSchema = z.enum(["daily", "weekly", "monthly"]);
type Period = z.infer<typeof periodSchema>;

/** Bucket key for a date under the given period — day (YYYY-MM-DD), ISO week start, or month (YYYY-MM). */
function bucketKey(date: Date, period: Period): string {
  if (period === "daily") return date.toISOString().slice(0, 10);
  if (period === "monthly") return date.toISOString().slice(0, 7);
  const weekStart = new Date(date);
  const dayOffset = (weekStart.getUTCDay() + 6) % 7; // Monday = 0
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOffset);
  return weekStart.toISOString().slice(0, 10);
}

function windowStart(period: Period): Date {
  const now = new Date();
  if (period === "daily") return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  if (period === "weekly") return new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
}

router.get("/rides-trend", requireAuth("admin"), async (req, res) => {
  const parsedPeriod = periodSchema.safeParse(req.query.period);
  const period = parsedPeriod.success ? parsedPeriod.data : "daily";

  const rides = await db.ride.findMany({
    where: { requestedAt: { gte: windowStart(period) } },
    select: { requestedAt: true, status: true },
  });

  const buckets = new Map<string, { total: number; completed: number; cancelled: number }>();
  for (const ride of rides) {
    const key = bucketKey(ride.requestedAt, period);
    const bucket = buckets.get(key) ?? { total: 0, completed: 0, cancelled: 0 };
    bucket.total += 1;
    if (ride.status === "completed") bucket.completed += 1;
    if (ride.status === "cancelled") bucket.cancelled += 1;
    buckets.set(key, bucket);
  }

  const trend = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, counts]) => ({ bucket, ...counts }));

  res.json({ period, trend });
});

router.get("/revenue-trend", requireAuth("admin"), async (req, res) => {
  const parsedPeriod = periodSchema.safeParse(req.query.period);
  const period = parsedPeriod.success ? parsedPeriod.data : "daily";

  const rides = await db.ride.findMany({
    where: { paymentStatus: "paid", completedAt: { gte: windowStart(period) } },
    select: { completedAt: true, fareTotal: true },
  });

  const buckets = new Map<string, number>();
  for (const ride of rides) {
    const key = bucketKey(ride.completedAt!, period);
    buckets.set(key, (buckets.get(key) ?? 0) + ride.fareTotal);
  }

  const trend = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, revenue]) => ({ bucket, revenue, commission: computeCommission(revenue) }));

  res.json({ period, trend });
});

router.get("/payment-success-rate", requireAuth("admin"), async (_req, res) => {
  const [paid, failed] = await Promise.all([
    db.ride.count({ where: { paymentStatus: "paid" } }),
    db.ride.count({ where: { paymentStatus: "failed" } }),
  ]);
  const decided = paid + failed;
  res.json({
    paid,
    failed,
    successRate: decided > 0 ? Math.round((paid / decided) * 1000) / 10 : 0,
  });
});

export default router;
