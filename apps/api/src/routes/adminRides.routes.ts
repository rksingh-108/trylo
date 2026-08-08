import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { serializeRide } from "../lib/serialize";

const router = Router();

const listSchema = z.object({
  customerId: z.string().optional(),
  driverId: z.string().optional(),
  status: z.enum(["requested", "matched", "arriving", "arrived", "in_progress", "completed", "cancelled"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get("/", requireAuth("admin"), async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { customerId, driverId, status, paymentStatus, from, to, page, limit } = parsed.data;

  const where = {
    ...(customerId ? { riderId: customerId } : {}),
    ...(driverId ? { driverId } : {}),
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(from || to
      ? { requestedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };

  const [rides, total] = await Promise.all([
    db.ride.findMany({
      where,
      include: { driver: true, rider: true },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.ride.count({ where }),
  ]);

  res.json({ rides: rides.map(serializeRide), total, page, limit });
});

router.get("/:id", requireAuth("admin"), async (req, res) => {
  const ride = await db.ride.findUnique({
    where: { id: req.params.id },
    include: { driver: true, rider: true },
  });
  res.json(ride ? serializeRide(ride) : null);
});

export default router;
