import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { serializeRide } from "../lib/serialize";
import { getWalletPayload } from "../lib/wallet";
import { logAdminAction } from "../lib/adminAudit";

const router = Router();

function serializeCustomer(user: {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  rating: number;
  walletBalance: number;
  suspended: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    email: user.email ?? undefined,
    rating: user.rating,
    walletBalance: user.walletBalance,
    suspended: user.suspended,
    createdAt: user.createdAt.toISOString(),
  };
}

const listSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get("/", requireAuth("admin"), async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { search, page, limit } = parsed.data;

  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { phone: { contains: search } }] }
    : {};

  const [customers, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  res.json({ customers: customers.map(serializeCustomer), total, page, limit });
});

router.get("/:id", requireAuth("admin"), async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(serializeCustomer(user));
});

router.get("/:id/rides", requireAuth("admin"), async (req, res) => {
  const rides = await db.ride.findMany({
    where: { riderId: req.params.id },
    include: { driver: true, rider: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(rides.map(serializeRide));
});

router.get("/:id/wallet", requireAuth("admin"), async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(await getWalletPayload(user.id));
});

const suspendSchema = z.object({ reason: z.string().optional() });

router.post("/:id/suspend", requireAuth("admin"), async (req, res) => {
  const parsed = suspendSchema.safeParse(req.body ?? {});
  const user = await db.user.update({ where: { id: req.params.id }, data: { suspended: true } }).catch(() => null);
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  await logAdminAction(req.auth!.id, "customer_suspended", "customer", user.id, parsed.success ? parsed.data.reason : undefined);
  res.json(serializeCustomer(user));
});

router.post("/:id/unsuspend", requireAuth("admin"), async (req, res) => {
  const user = await db.user.update({ where: { id: req.params.id }, data: { suspended: false } }).catch(() => null);
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  await logAdminAction(req.auth!.id, "customer_unsuspended", "customer", user.id);
  res.json(serializeCustomer(user));
});

export default router;
