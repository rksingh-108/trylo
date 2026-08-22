import type { FareBreakdown, Ride, RideLocation, RideMessage, SosAlertResult, VehicleType } from "@trylo/types";
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

export async function getRideMessages(rideId: string): Promise<RideMessage[]> {
  return apiClient.get<RideMessage[]>(`/api/customer/rides/${rideId}/messages`);
}

export interface TriggerSosInput {
  lat?: number;
  lng?: number;
  note?: string;
}

/** In-app emergency alert only - see apps/api/src/routes/customerRide.routes.ts for what this actually does (and doesn't) do. */
export async function triggerSos(rideId: string, input: TriggerSosInput = {}): Promise<SosAlertResult> {
  return apiClient.post<SosAlertResult>(`/api/customer/rides/${rideId}/sos`, input);
}
