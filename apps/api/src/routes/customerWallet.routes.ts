import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { getWalletPayload } from "../lib/wallet";

const router = Router();

router.get("/", requireAuth("customer"), async (req, res) => {
  res.json(await getWalletPayload(req.auth!.id));
});

// .int(): walletBalance/WalletTransaction.amount are Int columns - a
// non-integer amount would otherwise throw deep inside Prisma instead of
// failing validation cleanly. Capped well above any realistic top-up to
// reject an obviously-bogus value without constraining real usage.
const topUpSchema = z.object({ amount: z.number().int().positive().max(100_000) });

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
