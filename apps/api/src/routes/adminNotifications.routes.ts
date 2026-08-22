import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { serializeNotification } from "../lib/serialize";

const router = Router();

// Read-side only, for now - this is how an admin currently sees SOS alerts
// (see lib/notify.ts's notifyAllAdmins). There is no live push to admins yet
// and no dedicated SOS dashboard page; this endpoint exists so that data is
// at least retrievable via the API rather than only sitting in the database.
router.get("/", requireAuth("admin"), async (req, res) => {
  const notifications = await db.notification.findMany({
    where: { ownerId: req.auth!.id, ownerRole: "admin" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications.map(serializeNotification));
});

router.post("/:id/read", requireAuth("admin"), async (req, res) => {
  const { count } = await db.notification.updateMany({
    where: { id: req.params.id, ownerId: req.auth!.id, ownerRole: "admin" },
    data: { read: true },
  });
  res.json({ success: count > 0 });
});

export default router;
