import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();

const promoCreateSchema = z.object({
  code: z.string().min(2).max(32),
  discountPercent: z.number().int().min(1).max(100),
  maxDiscount: z.number().int().min(0).optional(),
  active: z.boolean().default(true),
});

const promoUpdateSchema = z.object({
  discountPercent: z.number().int().min(1).max(100).optional(),
  maxDiscount: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

/** Lists all promo codes (active and inactive) newest-first. */
router.get("/", requireAuth("admin"), async (req, res) => {
  const promos = await db.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  res.json(
    promos.map((p) => ({
      id: p.id,
      code: p.code,
      discountPercent: p.discountPercent,
      maxDiscount: p.maxDiscount,
      active: p.active,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }))
  );
});

/** Creates a new promo code. Codes are case-insensitive unique. */
router.post("/", requireAuth("admin"), async (req, res) => {
  const parsed = promoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid promo code" });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();

  const existing = await db.promoCode.findUnique({ where: { code } });
  if (existing) {
    res.status(409).json({ error: "A promo code with that name already exists" });
    return;
  }

  const promo = await db.promoCode.create({
    data: {
      code,
      discountPercent: parsed.data.discountPercent,
      maxDiscount: parsed.data.maxDiscount,
      active: parsed.data.active,
    },
  });

  res.status(201).json({
    id: promo.id,
    code: promo.code,
    discountPercent: promo.discountPercent,
    maxDiscount: promo.maxDiscount,
    active: promo.active,
    expiresAt: promo.expiresAt?.toISOString() ?? null,
    createdAt: promo.createdAt.toISOString(),
  });
});

/** Updates an existing promo code (discount, cap, or active toggle). */
router.patch("/:id", requireAuth("admin"), async (req, res) => {
  const parsed = promoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid promo update" });
    return;
  }

  const promo = await db.promoCode
    .update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.discountPercent !== undefined ? { discountPercent: parsed.data.discountPercent } : {}),
        ...(parsed.data.maxDiscount !== undefined ? { maxDiscount: parsed.data.maxDiscount } : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      },
    })
    .catch(() => null);
  if (!promo) {
    res.status(404).json({ error: "Promo code not found" });
    return;
  }

  res.json({
    id: promo.id,
    code: promo.code,
    discountPercent: promo.discountPercent,
    maxDiscount: promo.maxDiscount,
    active: promo.active,
    expiresAt: promo.expiresAt?.toISOString() ?? null,
    createdAt: promo.createdAt.toISOString(),
  });
});

export default router;