import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();

/** Lists support tickets, open first then newest, with the requester's identity. */
router.get("/", requireAuth("admin"), async (req, res) => {
  const tickets = await db.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const owners = await Promise.all(
    tickets.map(async (t) => {
      if (t.ownerRole === "driver") {
        const d = await db.driver.findUnique({ where: { id: t.ownerId }, select: { name: true, phone: true } });
        return { role: "driver" as const, name: d?.name ?? "Driver", phone: d?.phone ?? t.ownerId };
      }
      const u = await db.user.findUnique({ where: { id: t.ownerId }, select: { name: true, phone: true } });
      return { role: "customer" as const, name: u?.name ?? "Customer", phone: u?.phone ?? t.ownerId };
    })
  );

  res.json(
    tickets.map((t, i) => ({
      id: t.id,
      subject: t.subject,
      message: t.message,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      owner: owners[i],
    }))
  );
});

/** Marks a ticket resolved (idempotent — resolving an already-resolved ticket is a no-op). */
router.post("/:id/resolve", requireAuth("admin"), async (req, res) => {
  const ticket = await db.supportTicket
    .update({
      where: { id: req.params.id },
      data: { status: "resolved", resolvedAt: new Date() },
    })
    .catch(() => null);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({
    id: ticket.id,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  });
});

export default router;