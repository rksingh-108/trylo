import { db } from "../db";
import { emitNotificationToRide } from "../realtime/io";

type NotifyRole = "customer" | "driver";

interface NotifyRideEventOptions {
  /** The ride this notification is about - used to reach a live socket via the existing `ride:{rideId}` room. */
  rideId: string;
  ownerId: string;
  ownerRole: NotifyRole;
  title: string;
  body: string;
}

/**
 * Persists a Notification row and, best-effort, pushes it live to the ride's
 * existing Socket.IO room (see realtime/io.ts - both the rider and the
 * assigned driver are already joined to `ride:{rideId}` for the `ride:updated`
 * pushes, so this reuses that room instead of introducing new per-user rooms).
 *
 * Mirrors lib/rideHistory.ts's recordRideStatus: best-effort and never throws,
 * so a notification failure can never break the ride-lifecycle write path
 * that calls it.
 */
export async function notifyRideEvent(opts: NotifyRideEventOptions): Promise<void> {
  try {
    const notification = await db.notification.create({
      data: { ownerId: opts.ownerId, ownerRole: opts.ownerRole, title: opts.title, body: opts.body },
    });
    emitNotificationToRide(opts.rideId, opts.ownerRole, {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notify] failed to record/emit ride notification", err);
  }
}

/**
 * Admin-facing notifications (currently only SOS alerts) aren't tied to a
 * specific rider/driver socket room, so they're persisted only - an admin
 * picks them up via GET /api/admin/notifications. No live push to admins is
 * implemented yet (see the SOS route for why this is an intentional scope
 * boundary, not an oversight).
 */
export async function notifyAllAdmins(title: string, body: string): Promise<void> {
  try {
    const admins = await db.admin.findMany({ select: { id: true } });
    if (admins.length === 0) return;
    await db.notification.createMany({
      data: admins.map((a) => ({ ownerId: a.id, ownerRole: "admin" as const, title, body })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notify] failed to record admin notifications", err);
  }
}
