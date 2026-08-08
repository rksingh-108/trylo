import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { getWalletPayload } from "../lib/wallet";

const router = Router();

router.get("/", requireAuth("customer"), async (req, res) => {
  res.json(await getWalletPayload(req.auth!.id));
});

const topUpSchema = z.object({ amount: z.number().positive() });

router.post("/topup", requireAuth("customer"), async (req, res) => {
  const parsed = topUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  await db.$transaction([
    db.user.update({
      where: { id: req.auth!.id },
      data: { walletBalance: { increment: parsed.data.amount } },
    }),
    db.walletTransaction.create({
      data: {
        userId: req.auth!.id,
        type: "credit",
        category: "top_up",
        amount: parsed.data.amount,
        description: "Added money via UPI",
      },
    }),
  ]);

  res.json(await getWalletPayload(req.auth!.id));
});

export default router;
