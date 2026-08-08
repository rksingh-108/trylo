import type { AnalyticsPeriod, PaymentSuccessRate, RevenueTrendResult, RidesTrendResult } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getAdminRidesTrend(period: AnalyticsPeriod): Promise<RidesTrendResult> {
  return apiClient.get<RidesTrendResult>("/api/admin/analytics/rides-trend", { period });
}

export async function getAdminRevenueTrend(period: AnalyticsPeriod): Promise<RevenueTrendResult> {
  return apiClient.get<RevenueTrendResult>("/api/admin/analytics/revenue-trend", { period });
}

export async function getAdminPaymentSuccessRate(): Promise<PaymentSuccessRate> {
  return apiClient.get<PaymentSuccessRate>("/api/admin/analytics/payment-success-rate");
}
