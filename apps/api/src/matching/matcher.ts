import { db } from "../db";
import { haversineKm } from "../lib/geo";
import { serializeRide } from "../lib/serialize";
import { emitIncomingRequest, emitRequestCleared, emitRideUpdated } from "../realtime/io";
import { recordRideStatus } from "../lib/rideHistory";

const OFFER_WINDOW_MS = 15_000;
const TICK_MS = 1_000;
// A ride that has burned through this many driver exclusions without being
// accepted is treated as undispatchable and auto-cancelled instead of
// silently sitting in "requested" forever with no signal to the rider.
const MAX_MATCH_ATTEMPTS = 8;

const ACTIVE_DRIVER_STATUSES = ["requested", "arriving", "arrived", "in_progress"] as const;

async function expireStaleOffers() {
  const stale = await db.ride.findMany({
    where: { status: "requested", driverId: { not: null }, offerExpiresAt: { lte: new Date() } },
  });
  for (const ride of stale) {
    await db.ride.update({
      where: { id: ride.id },
      data: {
        driverId: null,
        offerExpiresAt: null,
        excludedDriverIds: ride.driverId ? { push: ride.driverId } : undefined,
      },
    });
    if (ride.driverId) emitRequestCleared(ride.driverId);
  }
}

/**
 * Higher is better. Blends normalized distance, rating, acceptance rate, and
 * idle time so the nearest driver isn't automatically picked if a
 * comparably-close driver is meaningfully more reliable or has been waiting
 * longer for a fare (fairness/rotation) — a plain nearest-driver scan (the
 * previous behavior) tends to repeatedly slam the same closest driver.
 */
function scoreCandidate(
  driver: { lat: number; lng: number; rating: number; offeredCount: number; acceptedCount: number; onlineSince: Date | null; lastRideEndedAt: Date | null },
  pickup: { lat: number; lng: number },
  maxDistanceKm: number
) {
  const distanceKm = haversineKm(driver, pickup);
  const distanceScore = 1 - Math.min(1, distanceKm / Math.max(maxDistanceKm, 0.1));

  const ratingScore = Math.min(1, Math.max(0, (driver.rating - 1) / 4));

  // Acceptance rate: a driver with no offer history yet gets a neutral 0.8
  // rather than 0 or 1, so brand-new drivers aren't unfairly favored or
  // penalized before they have a track record.
  const acceptanceRate = driver.offeredCount > 0 ? driver.acceptedCount / driver.offeredCount : 0.8;

  const idleSinceMs = Date.now() - (driver.lastRideEndedAt ?? driver.onlineSince ?? new Date()).getTime();
  const idleMinutes = Math.max(0, idleSinceMs / 60_000);
  const idleScore = Math.min(1, idleMinutes / 15); // saturates at 15 min idle

  return distanceScore * 0.5 + ratingScore * 0.2 + acceptanceRate * 0.2 + idleScore * 0.1;
}

async function cancelUndispatchableRide(rideId: string) {
  const updated = await db.ride.update({
    where: { id: rideId },
    data: { status: "cancelled", cancelledAt: new Date(), cancelReason: "no_drivers_available" },
    include: { driver: true, rider: true },
  });
  await recordRideStatus(rideId, "cancelled", "no_drivers_available");
  emitRideUpdated(updated.id, serializeRide(updated));
}

async function offerUnassignedRides() {
  const unassigned = await db.ride.findMany({
    where: { status: "requested", driverId: null },
    orderBy: { requestedAt: "asc" },
  });
  if (unassigned.length === 0) return;

  // Drivers currently tied up (either offered a ride or actively on one).
  const busyDriverIds = new Set(
    (
      await db.ride.findMany({
        where: { status: { in: [...ACTIVE_DRIVER_STATUSES] }, driverId: { not: null } },
        select: { driverId: true },
      })
    ).map((r) => r.driverId as string)
  );

  for (const ride of unassigned) {
    if (ride.excludedDriverIds.length >= MAX_MATCH_ATTEMPTS) {
      await cancelUndispatchableRide(ride.id);
      continue;
    }

    const candidates = await db.driver.findMany({
      where: {
        isOnline: true,
        verificationStatus: "verified",
        vehicleType: ride.vehicleType,
        id: { notIn: [...busyDriverIds, ...ride.excludedDriverIds] },
      },
    });
    if (candidates.length === 0) continue;

    const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
    const maxDistanceKm = Math.max(...candidates.map((d) => haversineKm(d, pickup)), 1);
    const best = candidates.reduce((top, driver) => {
      const score = scoreCandidate(driver, pickup, maxDistanceKm);
      const topScore = scoreCandidate(top, pickup, maxDistanceKm);
      return score > topScore ? driver : top;
    });

    const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_MS);
    const updated = await db.ride.update({
      where: { id: ride.id },
      data: { driverId: best.id, offerExpiresAt },
      include: { rider: true },
    });
    await db.driver.update({ where: { id: best.id }, data: { offeredCount: { increment: 1 } } });

    busyDriverIds.add(best.id);
    emitIncomingRequest(best.id, { ride: serializeRide(updated), expiresAt: offerExpiresAt.toISOString() });
  }
}

let running = false;

export function startMatchingLoop() {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await expireStaleOffers();
      await offerUnassignedRides();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[matching loop] error", err);
    } finally {
      running = false;
    }
  }, TICK_MS);
}
