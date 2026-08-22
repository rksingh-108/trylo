import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();

const walletTxnListSchema = z.object({
  category: z.enum(["ride", "top_up", "refund", "payout", "bonus", "cancellation_fee"]).optional(),
  type: z.enum(["credit", "debit"]).optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get("/wallet-transactions", requireAuth("admin"), async (req, res) => {
  const parsed = walletTxnListSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { category, type, userId, page, limit } = parsed.data;
  const where = {
    ...(category ? { category } : {}),
    ...(type ? { type } : {}),
    ...(userId ? { userId } : {}),
  };

  const [transactions, total] = await Promise.all([
    db.walletTransaction.findMany({
      where,
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.walletTransaction.count({ where }),
  ]);

  res.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.user.name,
      userPhone: t.user.phone,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      rideId: t.rideId ?? undefined,
      createdAt: t.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
});

const earningsListSchema = z.object({
  driverId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get("/driver-earnings", requireAuth("admin"), async (req, res) => {
  const parsed = earningsListSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { driverId, page, limit } = parsed.data;
  const where = driverId ? { driverId } : {};

  const [earnings, total] = await Promise.all([
    db.driverEarning.findMany({
      where,
      include: { driver: { select: { name: true, phone: true } }, ride: { select: { distanceKm: true, dropAddress: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.driverEarning.count({ where }),
  ]);

  res.json({
    earnings: earnings.map((e) => ({
      id: e.id,
      driverId: e.driverId,
      driverName: e.driver.name,
      driverPhone: e.driver.phone,
      rideId: e.rideId,
      amount: e.amount,
      distanceKm: e.ride.distanceKm,
      dropAddress: e.ride.dropAddress,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
});

export default router;
