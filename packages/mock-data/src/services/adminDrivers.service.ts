import type {
  AdminDriverEarningsSummary,
  AdminDriverListResult,
  AdminDriverSummary,
  KycDocument,
  Ride,
} from "@trylo/types";
import { apiClient } from "../apiClient";

export interface AdminDriverListQuery {
  search?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  isOnline?: boolean;
  page?: number;
  limit?: number;
}

export async function listAdminDrivers(query: AdminDriverListQuery = {}): Promise<AdminDriverListResult> {
  return apiClient.get<AdminDriverListResult>("/api/admin/drivers", { ...query });
}

export async function getAdminDriver(id: string): Promise<AdminDriverSummary | null> {
  return apiClient.get<AdminDriverSummary | null>(`/api/admin/drivers/${id}`);
}

export async function getAdminDriverKyc(id: string): Promise<KycDocument[]> {
  return apiClient.get<KycDocument[]>(`/api/admin/drivers/${id}/kyc`);
}

export async function getAdminDriverRides(id: string): Promise<Ride[]> {
  return apiClient.get<Ride[]>(`/api/admin/drivers/${id}/rides`);
}

export async function getAdminDriverEarnings(id: string): Promise<AdminDriverEarningsSummary> {
  return apiClient.get<AdminDriverEarningsSummary>(`/api/admin/drivers/${id}/earnings`);
}

export async function approveAdminDriver(id: string): Promise<AdminDriverSummary> {
  return apiClient.post<AdminDriverSummary>(`/api/admin/drivers/${id}/approve`);
}

export async function rejectAdminDriver(id: string, reason?: string): Promise<AdminDriverSummary> {
  return apiClient.post<AdminDriverSummary>(`/api/admin/drivers/${id}/reject`, { reason });
}

export async function suspendAdminDriver(id: string, reason?: string): Promise<AdminDriverSummary> {
  return apiClient.post<AdminDriverSummary>(`/api/admin/drivers/${id}/suspend`, { reason });
}

export async function unsuspendAdminDriver(id: string): Promise<AdminDriverSummary> {
  return apiClient.post<AdminDriverSummary>(`/api/admin/drivers/${id}/unsuspend`);
}
