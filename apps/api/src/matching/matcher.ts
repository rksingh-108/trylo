import { db } from "../db";
import { haversineKm } from "../lib/geo";
import { serializeRide } from "../lib/serialize";
import { emitIncomingRequest } from "../realtime/io";

const OFFER_WINDOW_MS = 15_000;
const TICK_MS = 1_000;

const ACTIVE_DRIVER_STATUSES = ["requested", "arriving", "in_progress"] as const;

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
  }
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
    const candidates = await db.driver.findMany({
      where: {
        isOnline: true,
        verificationStatus: "verified",
        vehicleType: ride.vehicleType,
        id: { notIn: [...busyDriverIds, ...ride.excludedDriverIds] },
      },
    });
    if (candidates.length === 0) continue;

    const nearest = candidates.reduce((best, driver) => {
      const dist = haversineKm(driver, { lat: ride.pickupLat, lng: ride.pickupLng });
      const bestDist = haversineKm(best, { lat: ride.pickupLat, lng: ride.pickupLng });
      return dist < bestDist ? driver : best;
    });

    const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_MS);
    const updated = await db.ride.update({
      where: { id: ride.id },
      data: { driverId: nearest.id, offerExpiresAt },
      include: { rider: true },
    });

    busyDriverIds.add(nearest.id);
    emitIncomingRequest(nearest.id, { ride: serializeRide(updated), expiresAt: offerExpiresAt.toISOString() });
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
