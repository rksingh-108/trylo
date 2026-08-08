import { db } from "../db";

export async function getWalletPayload(userId: string) {
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
