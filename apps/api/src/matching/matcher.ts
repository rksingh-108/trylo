import { VehicleType } from "@prisma/client";
import { db } from "../db";
import { haversineKm } from "../lib/geo";
import { serializeRide } from "../lib/serialize";
import { emitIncomingRequest, emitRequestCleared, emitRideUpdated } from "../realtime/io";
import { recordRideStatus } from "../lib/rideHistory";
import { notifyRideEvent } from "../lib/notify";

const OFFER_WINDOW_MS = 15_000;
const TICK_MS = 1_000;
// A ride that has burned through this many driver exclusions without being
// accepted is treated as undispatchable and auto-cancelled instead of
// silently sitting in "requested" forever with no signal to the rider.
const MAX_MATCH_ATTEMPTS = 8;

const ACTIVE_DRIVER_STATUSES = ["requested", "arriving", "arrived", "in_progress"] as const;

// Candidate-discovery tuning. Radius search is progressive: try the nearest
// tier first and only widen if it comes back empty, rather than always
// searching the full 3km - most rides should match a driver within 1km, so
// this keeps the common case cheap (small index scan) while still covering
// out to 3km for the sparser cases. Never searches beyond the last tier.
const RADIUS_TIERS_METERS = [1_000, 2_000, 3_000] as const;
const LOCATION_STALE_MS = 45_000;
const MAX_CANDIDATES = 25;

interface DriverCandidate {
  id: string;
  lat: number;
  lng: number;
  rating: number;
  offeredCount: number;
  acceptedCount: number;
  onlineSince: Date | null;
  lastRideEndedAt: Date | null;
}

/**
 * Fetches online/verified/non-suspended/matching-vehicle-type drivers within
 * radiusMeters of pickup, with a location fresher than LOCATION_STALE_MS,
 * nearest-first, capped at MAX_CANDIDATES. Replaces what used to be an
 * unfiltered `db.driver.findMany` (every online driver regardless of
 * distance) with an index-backed query: earth_box(...) @> geo is the
 * earthdistance idiom that actually uses the GiST index on Driver.geo (a
 * bare earth_distance() comparison alone is not indexable), and the
 * composite (isOnline, verificationStatus, suspended, vehicleType) index
 * backs the rest of the WHERE clause. Everything downstream (scoreCandidate,
 * the final pick, offer/accept/timeout/exclusion behavior) is unchanged -
 * only how this candidate set is fetched, and at what radius, changed.
 */
async function findNearbyCandidates(
  pickup: { lat: number; lng: number },
  vehicleType: VehicleType,
  excludeIds: string[],
  radiusMeters: number
): Promise<DriverCandidate[]> {
  const excluded = excludeIds.length > 0 ? excludeIds : [""];
  return db.$queryRaw<DriverCandidate[]>`
    SELECT id, lat, lng, rating, "offeredCount", "acceptedCount", "onlineSince", "lastRideEndedAt"
    FROM "Driver"
    WHERE "isOnline" = true
      AND "verificationStatus" = 'verified'
      AND suspended = false
      AND "vehicleType" = ${vehicleType}::"VehicleType"
      AND NOT (id = ANY(${excluded}::text[]))
      AND "locationUpdatedAt" IS NOT NULL
      AND "locationUpdatedAt" > now() - (${LOCATION_STALE_MS}::text || ' milliseconds')::interval
      AND earth_box(ll_to_earth(${pickup.lat}, ${pickup.lng}), ${radiusMeters}) @> geo
      AND earth_distance(ll_to_earth(${pickup.lat}, ${pickup.lng}), geo) <= ${radiusMeters}
    ORDER BY earth_distance(ll_to_earth(${pickup.lat}, ${pickup.lng}), geo) ASC
    LIMIT ${MAX_CANDIDATES}
  `;
}

/**
 * Progressive radius search: tries RADIUS_TIERS_METERS in order (1km, 2km,
 * 3km) and returns the first tier's results that come back non-empty,
 * without querying any wider tier. Returns an empty array only if every
 * tier out to the last one is empty - the ride is then left unassigned this
 * tick (picked up again next tick, or eventually auto-cancelled via
 * MAX_MATCH_ATTEMPTS/cancelUndispatchableRide, exactly as before).
 */
async function findNearbyCandidatesProgressive(
  pickup: { lat: number; lng: number },
  vehicleType: VehicleType,
  excludeIds: string[]
): Promise<DriverCandidate[]> {
  for (const radiusMeters of RADIUS_TIERS_METERS) {
    const candidates = await findNearbyCandidates(pickup, vehicleType, excludeIds, radiusMeters);
    if (candidates.length > 0) return candidates;
  }
  return [];
}

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
  await notifyRideEvent({
    rideId: updated.id,
    ownerId: updated.riderId,
    ownerRole: "customer",
    title: "No drivers available",
    body: "We couldn't find a nearby driver. Please try again in a moment.",
  });
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

    const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
    const candidates = await findNearbyCandidatesProgressive(pickup, ride.vehicleType, [
      ...busyDriverIds,
      ...ride.excludedDriverIds,
    ]);
    if (candidates.length === 0) continue;

    const maxDistanceKm = Math.max(...candidates.map((d) => haversineKm(d, pickup)), 1);
    const best = candidates.reduce((top, driver) => {
      const score = scoreCandidate(driver, pickup, maxDistanceKm);
      const topScore = scoreCandidate(top, pickup, maxDistanceKm);
      return score > topScore ? driver : top;
    });

    const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_MS);
    // Guarded on status + driverId:null so a concurrent customer-cancel (which
    // only succeeds while the ride is still unassigned/"requested") can never
    // be silently overwritten by this offer landing a moment later - if the
    // ride moved on in the meantime, skip it instead of resurrecting it with a
    // stale offer.
    const { count } = await db.ride.updateMany({
      where: { id: ride.id, status: "requested", driverId: null },
      data: { driverId: best.id, offerExpiresAt },
    });
    if (count === 0) continue;

    const updated = await db.ride.findUniqueOrThrow({ where: { id: ride.id }, include: { rider: true } });
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
