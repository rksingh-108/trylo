import type { Ride } from "@trylo/types";
import { networkDelay, randomId } from "../latency";
import { addressSuggestions, computeFare } from "../seed";
import { driverDb } from "../store";

const REQUEST_APPEAR_AFTER_MS = 4000;
const REQUEST_EXPIRES_AFTER_MS = 15000;

function generateIncomingRequest(): Ride {
  const vehicleType = driverDb.driver?.vehicle.type ?? "bike";
  const pickup = addressSuggestions[Math.floor(Math.random() * addressSuggestions.length)]!;
  const drop = addressSuggestions[Math.floor(Math.random() * addressSuggestions.length)]!;
  const { fare, etaMinutes } = computeFare(vehicleType, 1 + Math.random() * 6);

  return {
    id: randomId("ride"),
    status: "requested",
    vehicleType,
    pickup: { address: pickup.primaryText, point: pickup.point },
    drop: { address: drop.primaryText, point: drop.point },
    riderId: randomId("rider"),
    fare,
    otp: String(Math.floor(1000 + Math.random() * 8999)),
    distanceKm: Math.round((1 + Math.random() * 6) * 10) / 10,
    durationMin: etaMinutes,
    requestedAt: new Date().toISOString(),
  };
}

/** Polled from the dashboard while online — simulates a ride request arriving, then expiring if unanswered. */
export async function getIncomingRequest(): Promise<Ride | null> {
  if (!driverDb.isOnline || driverDb.activeRide) {
    return networkDelay(null, 150, 300);
  }

  if (driverDb.incomingRequest && driverDb.incomingRequestExpiresAt) {
    if (Date.now() > new Date(driverDb.incomingRequestExpiresAt).getTime()) {
      driverDb.incomingRequest = null;
      driverDb.incomingRequestExpiresAt = null;
    }
    return networkDelay(driverDb.incomingRequest, 150, 300);
  }

  const onlineElapsed = driverDb.onlineSince
    ? Date.now() - new Date(driverDb.onlineSince).getTime()
    : 0;
  if (onlineElapsed >= REQUEST_APPEAR_AFTER_MS) {
    driverDb.incomingRequest = generateIncomingRequest();
    driverDb.incomingRequestExpiresAt = new Date(Date.now() + REQUEST_EXPIRES_AFTER_MS).toISOString();
  }
  return networkDelay(driverDb.incomingRequest, 150, 300);
}

export async function acceptRideRequest(rideId: string): Promise<Ride | null> {
  if (!driverDb.incomingRequest || driverDb.incomingRequest.id !== rideId) {
    return networkDelay(null);
  }
  const ride: Ride = {
    ...driverDb.incomingRequest,
    status: "arriving",
    driverId: driverDb.driver?.id,
    driver: driverDb.driver ?? undefined,
    matchedAt: new Date().toISOString(),
  };
  driverDb.activeRide = ride;
  driverDb.incomingRequest = null;
  driverDb.incomingRequestExpiresAt = null;
  return networkDelay({ ...ride }, 250, 500);
}

export async function rejectRideRequest(rideId: string): Promise<void> {
  if (driverDb.incomingRequest?.id === rideId) {
    driverDb.incomingRequest = null;
    driverDb.incomingRequestExpiresAt = null;
  }
  return networkDelay(undefined, 150, 300);
}

export async function getActiveDriverRide(): Promise<Ride | null> {
  return networkDelay(driverDb.activeRide ? { ...driverDb.activeRide } : null, 150, 300);
}

export async function verifyRiderOtp(rideId: string, otp: string): Promise<{ success: boolean; ride: Ride | null }> {
  const ride = driverDb.activeRide;
  if (!ride || ride.id !== rideId) return networkDelay({ success: false, ride: null });

  if (otp !== ride.otp) {
    return networkDelay({ success: false, ride: { ...ride } }, 300, 600);
  }
  ride.status = "in_progress";
  ride.startedAt = new Date().toISOString();
  return networkDelay({ success: true, ride: { ...ride } }, 300, 600);
}

export async function endRide(rideId: string): Promise<Ride | null> {
  const ride = driverDb.activeRide;
  if (!ride || ride.id !== rideId) return networkDelay(null);

  ride.status = "completed";
  ride.completedAt = new Date().toISOString();
  driverDb.rideHistory.unshift(ride);
  driverDb.activeRide = null;
  if (driverDb.driver) {
    driverDb.driver = { ...driverDb.driver, totalRides: driverDb.driver.totalRides + 1 };
  }
  return networkDelay({ ...ride }, 300, 600);
}

export async function getDriverRideHistory(): Promise<Ride[]> {
  return networkDelay([...driverDb.rideHistory]);
}
