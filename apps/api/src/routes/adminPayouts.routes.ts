import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();

/** Lists all payout requests, newest-first, with the requesting driver's name. */
router.get("/", requireAuth("admin"), async (req, res) => {
  const payouts = await db.payoutRecord.findMany({
    include: { driver: { select: { id: true, name: true, phone: true } } },
    orderBy: { initiatedAt: "desc" },
  });

  res.json(
    payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      bankAccountLast4: p.bankAccountLast4,
      initiatedAt: p.initiatedAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
      driver: p.driver,
    }))
  );
});

/**
 * Processes a payout request (pending -> processed). Only a request that is
 * still 'pending' can be processed — an idempotent CAS so double-clicks and
 * concurrent admin sessions can't process the same payout twice or clobber a
 * previously processed/rejected one.
 */
router.post("/:id/process", requireAuth("admin"), async (req, res) => {
  const updated = await db.payoutRecord
    .updateMany({
      where: { id: req.params.id, status: "pending" },
      data: { status: "processed", processedAt: new Date() },
    })
    .catch(() => ({ count: 0 }));
  if (updated.count === 0) {
    res.status(409).json({ error: "Payout is no longer pending" });
    return;
  }
  const payout = await db.payoutRecord.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json({
    id: payout.id,
    amount: payout.amount,
    status: payout.status,
    bankAccountLast4: payout.bankAccountLast4,
    initiatedAt: payout.initiatedAt.toISOString(),
    processedAt: payout.processedAt?.toISOString() ?? null,
  });
});

/** Rejects a payout request (pending -> failed). Same pending-only CAS as process. */
router.post("/:id/reject", requireAuth("admin"), async (req, res) => {
  const updated = await db.payoutRecord
    .updateMany({
      where: { id: req.params.id, status: "pending" },
      data: { status: "failed", processedAt: new Date() },
    })
    .catch(() => ({ count: 0 }));
  if (updated.count === 0) {
    res.status(409).json({ error: "Payout is no longer pending" });
    return;
  }
  const payout = await db.payoutRecord.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json({
    id: payout.id,
    amount: payout.amount,
    status: payout.status,
    bankAccountLast4: payout.bankAccountLast4,
    initiatedAt: payout.initiatedAt.toISOString(),
    processedAt: payout.processedAt?.toISOString() ?? null,
  });
});

export default router;