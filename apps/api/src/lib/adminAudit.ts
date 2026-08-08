import { db } from "../db";
import type { Prisma } from "@prisma/client";

/** Records an admin mutation for audit purposes. Best-effort: never blocks the caller. */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: Prisma.AdminActionLogCreateInput["targetType"],
  targetId: string,
  note?: string
) {
  try {
    await db.adminActionLog.create({ data: { adminId, action, targetType, targetId, note } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[adminAudit] failed to record action", adminId, action, err);
  }
}
