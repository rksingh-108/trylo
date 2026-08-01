import type { FareBreakdown, Ride, RideLocation, VehicleType } from "@trylo/types";
import { apiClient } from "../apiClient";

export interface CreateRideInput {
  pickup: RideLocation;
  drop: RideLocation;
  vehicleType: VehicleType;
  fare: FareBreakdown;
}

export async function createRide(input: CreateRideInput): Promise<Ride> {
  return apiClient.post<Ride>("/api/customer/rides", input);
}

export async function getRideStatus(rideId: string): Promise<Ride | null> {
  return apiClient.get<Ride | null>(`/api/customer/rides/${rideId}/status`);
}

export async function cancelRide(rideId: string, reason: string): Promise<Ride | null> {
  return apiClient.post<Ride | null>(`/api/customer/rides/${rideId}/cancel`, { reason });
}

/**
 * Only the driver can end a trip for real (POST /api/driver/rides/:id/end) — kept here for
 * API-surface parity; it returns the ride's current state rather than force-completing it.
 */
export async function completeRide(rideId: string): Promise<Ride | null> {
  return apiClient.get<Ride | null>(`/api/customer/rides/${rideId}/status`);
}

export async function rateRide(rideId: string, rating: number, tip = 0): Promise<Ride | null> {
  return apiClient.post<Ride | null>(`/api/customer/rides/${rideId}/rate`, { rating, tip });
}

export async function getActiveRide(): Promise<Ride | null> {
  return apiClient.get<Ride | null>("/api/customer/rides/active");
}
