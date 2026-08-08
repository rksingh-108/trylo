import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();

async function getWalletPayload(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const transactions = await db.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return {
    balance: user.walletBalance,
    currency: "INR" as const,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
      rideId: t.rideId ?? undefined,
    })),
  };
}

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
