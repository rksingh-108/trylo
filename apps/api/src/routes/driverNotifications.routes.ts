import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { serializeNotification } from "../lib/serialize";

const router = Router();

router.get("/", requireAuth("driver"), async (req, res) => {
  const notifications = await db.notification.findMany({
    where: { ownerId: req.auth!.id, ownerRole: "driver" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications.map(serializeNotification));
});

router.post("/:id/read", requireAuth("driver"), async (req, res) => {
  const { count } = await db.notification.updateMany({
    where: { id: req.params.id, ownerId: req.auth!.id, ownerRole: "driver" },
    data: { read: true },
  });
  res.json({ success: count > 0 });
});

router.post("/read-all", requireAuth("driver"), async (req, res) => {
  await db.notification.updateMany({
    where: { ownerId: req.auth!.id, ownerRole: "driver", read: false },
    data: { read: true },
  });
  res.status(204).end();
});

export default router;
