import type { Driver } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function setOnlineStatus(isOnline: boolean): Promise<Driver> {
  return apiClient.post<Driver>("/api/driver/status", { isOnline });
}

export interface DashboardSummary {
  driver: Driver;
  isOnline: boolean;
  todayEarnings: number;
  todayRides: number;
  onlineMinutes: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  return apiClient.get<DashboardSummary | null>("/api/driver/dashboard");
}
