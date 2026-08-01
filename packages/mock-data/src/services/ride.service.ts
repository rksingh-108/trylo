import type { FareBreakdown, Ride, RideLocation, VehicleType } from "@trylo/types";
import { networkDelay, randomId } from "../latency";
import { generateNearbyDrivers, haversineKm } from "../seed";
import { customerDb } from "../store";

const MATCHED_AT_MS = 3000;
const ARRIVING_AT_MS = 6000;
const IN_PROGRESS_AT_MS = 13000;
const TRIP_DURATION_MS = 12000;

export interface CreateRideInput {
  pickup: RideLocation;
  drop: RideLocation;
  vehicleType: VehicleType;
  fare: FareBreakdown;
}

export async function createRide(input: CreateRideInput): Promise<Ride> {
  if (!customerDb.user) throw new Error("No authenticated user");

  const distanceKm = Math.max(0.8, haversineKm(input.pickup.point, input.drop.point));
  const ride: Ride = {
    id: randomId("ride"),
    status: "requested",
    vehicleType: input.vehicleType,
    pickup: input.pickup,
    drop: input.drop,
    riderId: customerDb.user.id,
    fare: input.fare,
    otp: String(Math.floor(1000 + Math.random() * 8999)),
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin: Math.max(3, Math.round((distanceKm / 24) * 60)),
    requestedAt: new Date().toISOString(),
  };

  customerDb.activeRide = ride;
  return networkDelay(ride, 300, 600);
}

/** Advances the simulated ride lifecycle based on elapsed time, then returns the current state. */
export async function getRideStatus(rideId: string): Promise<Ride | null> {
  const ride = customerDb.activeRide;
  if (!ride || ride.id !== rideId) return networkDelay(null, 150, 300);

  const elapsed = Date.now() - new Date(ride.requestedAt).getTime();

  if (elapsed >= MATCHED_AT_MS && ride.status === "requested") {
    const [driver] = generateNearbyDrivers(ride.vehicleType, 1);
    if (driver) {
      ride.status = "matched";
      ride.driverId = driver.id;
      ride.driver = driver;
      ride.matchedAt = new Date().toISOString();
    }
  }
  if (elapsed >= ARRIVING_AT_MS && ride.status === "matched") {
    ride.status = "arriving";
  }
  if (elapsed >= IN_PROGRESS_AT_MS && ride.status === "arriving") {
    ride.status = "in_progress";
    ride.startedAt = new Date().toISOString();
  }
  if (ride.status === "in_progress" && ride.startedAt) {
    const tripElapsed = Date.now() - new Date(ride.startedAt).getTime();
    if (tripElapsed >= TRIP_DURATION_MS) {
      ride.status = "completed";
      ride.completedAt = new Date().toISOString();
      customerDb.rideHistory.unshift(ride);
      customerDb.activeRide = null;
    }
  }

  return networkDelay({ ...ride }, 150, 350);
}

export async function cancelRide(rideId: string, reason: string): Promise<Ride | null> {
  const ride = customerDb.activeRide;
  if (!ride || ride.id !== rideId) return networkDelay(null);

  ride.status = "cancelled";
  ride.cancelledAt = new Date().toISOString();
  ride.cancelReason = reason;
  customerDb.rideHistory.unshift(ride);
  customerDb.activeRide = null;
  return networkDelay({ ...ride });
}

export async function completeRide(rideId: string): Promise<Ride | null> {
  const ride = customerDb.activeRide;
  if (!ride || ride.id !== rideId) return networkDelay(null);

  ride.status = "completed";
  ride.completedAt = new Date().toISOString();
  customerDb.rideHistory.unshift(ride);
  customerDb.activeRide = null;
  return networkDelay({ ...ride }, 300, 600);
}

export async function rateRide(
  rideId: string,
  rating: number,
  tip = 0
): Promise<Ride | null> {
  const ride = customerDb.rideHistory.find((r) => r.id === rideId);
  if (!ride) return networkDelay(null);
  ride.rating = rating;
  ride.tip = tip;
  return networkDelay({ ...ride });
}

export async function getActiveRide(): Promise<Ride | null> {
  return networkDelay(customerDb.activeRide ? { ...customerDb.activeRide } : null, 150, 300);
}
