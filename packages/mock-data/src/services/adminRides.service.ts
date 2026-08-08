import type { AdminRideFilter, AdminRideListResult, Ride } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function listAdminRides(filter: AdminRideFilter = {}): Promise<AdminRideListResult> {
  return apiClient.get<AdminRideListResult>("/api/admin/rides", { ...filter });
}

export async function getAdminRide(id: string): Promise<Ride | null> {
  return apiClient.get<Ride | null>(`/api/admin/rides/${id}`);
}
