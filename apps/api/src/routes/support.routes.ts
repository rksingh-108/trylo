import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

/**
 * Shared support-ticket routes, mounted under both /api/customer/support and
 * /api/driver/support with the corresponding role pinned by requireAuth. The
 * ownerRole stored on each ticket is the caller's actual role, so a customer
 * token can never raise (or read) a ticket as a driver and vice versa.
 */
export function createSupportRouter(role: "customer" | "driver"): Router {
  const router = Router();

  const ticketSchema = z.object({
    subject: z.string().min(3).max(120),
    message: z.string().min(5).max(2000),
  });

  /** Lists the caller's own tickets, newest first. */
  router.get("/", requireAuth(role), async (req, res) => {
    const tickets = await db.supportTicket.findMany({
      where: { ownerId: req.auth!.id, ownerRole: role },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        resolvedAt: t.resolvedAt?.toISOString() ?? null,
      }))
    );
  });

  /** Opens a new support ticket. */
  router.post("/", requireAuth(role), async (req, res) => {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ticket" });
      return;
    }
    const ticket = await db.supportTicket.create({
      data: {
        ownerId: req.auth!.id,
        ownerRole: role,
        subject: parsed.data.subject,
        message: parsed.data.message,
      },
    });
    res.status(201).json({
      id: ticket.id,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    });
  });

  return router;
}