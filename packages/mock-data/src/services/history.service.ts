import type { Ride } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getRideHistory(): Promise<Ride[]> {
  return apiClient.get<Ride[]>("/api/customer/rides/history");
}

export async function getRideDetail(rideId: string): Promise<Ride | null> {
  return apiClient.get<Ride | null>(`/api/customer/rides/history/${rideId}`);
}
