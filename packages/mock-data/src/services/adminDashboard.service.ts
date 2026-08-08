import type { AdminDashboardStats } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  return apiClient.get<AdminDashboardStats>("/api/admin/dashboard");
}
