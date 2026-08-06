import type { Driver, Ride } from "@trylo/types";
import { apiClient } from "../apiClient";

export interface IncomingRequestOffer {
  ride: Ride;
  expiresAt: string;
}

export async function getIncomingRequest(): Promise<IncomingRequestOffer | null> {
  return apiClient.get<IncomingRequestOffer | null>("/api/driver/requests/incoming");
}

export async function acceptRideRequest(rideId: string): Promise<Ride | null> {
  return apiClient.post<Ride | null>(`/api/driver/requests/${rideId}/accept`);
}

export async function rejectRideRequest(rideId: string): Promise<void> {
  await apiClient.post<void>(`/api/driver/requests/${rideId}/reject`);
}

export async function getActiveDriverRide(): Promise<Ride | null> {
  return apiClient.get<Ride | null>("/api/driver/rides/active");
}

export async function verifyRiderOtp(rideId: string, otp: string): Promise<{ success: boolean; ride: Ride | null }> {
  return apiClient.post<{ success: boolean; ride: Ride | null }>(`/api/driver/rides/${rideId}/verify-otp`, { otp });
}

export async function endRide(rideId: string): Promise<Ride | null> {
  return apiClient.post<Ride | null>(`/api/driver/rides/${rideId}/end`);
}

export async function getDriverRideHistory(): Promise<Ride[]> {
  return apiClient.get<Ride[]>("/api/driver/rides/history");
}

export async function updateDriverLocation(lat: number, lng: number): Promise<Driver> {
  return apiClient.post<Driver>("/api/driver/location", { lat, lng });
}
