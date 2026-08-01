import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { createOtpChallenge, verifyOtpChallenge } from "../auth/otp";
import { signToken } from "../auth/jwt";
import { requireAuth } from "../auth/middleware";
import { defaultPaymentMethods, defaultSavedPlaces } from "../lib/addresses";

const router = Router();

const phoneSchema = z.object({ phone: z.string().min(6) });

router.post("/otp/request", async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid phone" });
    return;
  }
  const devHintOtp = await createOtpChallenge(parsed.data.phone, "customer");
  res.json({ requestId: `otpreq_${Date.now()}`, devHintOtp });
});

const verifySchema = z.object({ phone: z.string().min(6), otp: z.string().length(4) });

router.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { phone, otp } = parsed.data;
  const success = await verifyOtpChallenge(phone, "customer", otp);
  if (!success) {
    res.json({ success: false, isNewUser: false, user: null });
    return;
  }

  let user = await db.user.findUnique({ where: { phone } });
  const isNewUser = !user;
  if (!user) {
    user = await db.user.create({ data: { phone } });
  }

  const token = signToken({ sub: user.id, role: "customer" });
  res.json({
    success: true,
    isNewUser,
    user: { id: user.id, phone: user.phone, name: user.name, email: user.email ?? undefined, rating: user.rating, createdAt: user.createdAt.toISOString() },
    token,
  });
});

const profileSchema = z.object({ name: z.string().min(1), email: z.string().email().optional() });

router.post("/profile", requireAuth("customer"), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile" });
    return;
  }

  const user = await db.user.update({
    where: { id: req.auth!.id },
    data: { name: parsed.data.name, email: parsed.data.email },
  });

  const existingPlaces = await db.savedPlace.count({ where: { userId: user.id } });
  if (existingPlaces === 0) {
    await db.savedPlace.createMany({
      data: defaultSavedPlaces.map((p) => ({
        userId: user.id,
        label: p.label,
        name: p.name,
        address: p.address,
        lat: p.point.lat,
        lng: p.point.lng,
      })),
    });
  }

  const existingMethods = await db.paymentMethod.count({ where: { userId: user.id } });
  if (existingMethods === 0) {
    await db.paymentMethod.createMany({
      data: defaultPaymentMethods.map((m) => ({
        userId: user.id,
        type: m.type,
        label: m.label,
        detail: m.detail,
        isDefault: m.isDefault,
      })),
    });
  }

  res.json({ id: user.id, phone: user.phone, name: user.name, email: user.email ?? undefined, rating: user.rating, createdAt: user.createdAt.toISOString() });
});

router.get("/me", requireAuth("customer"), async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.auth!.id } });
  if (!user) {
    res.json(null);
    return;
  }
  res.json({ id: user.id, phone: user.phone, name: user.name, email: user.email ?? undefined, rating: user.rating, createdAt: user.createdAt.toISOString() });
});

export default router;
