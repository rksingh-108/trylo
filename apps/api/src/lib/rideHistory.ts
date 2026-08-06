import { db } from "../db";
import type { RideStatus } from "@prisma/client";

/** Appends an audit-trail row for a ride status transition. Best-effort: never blocks the caller. */
export async function recordRideStatus(rideId: string, status: RideStatus, note?: string) {
  try {
    await db.rideStatusHistory.create({ data: { rideId, status, note } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[rideHistory] failed to record status", rideId, status, err);
  }
}
