import type { EarningsSummary, PayoutRecord, PayoutRequest } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getDriverEarnings(period: EarningsSummary["period"]): Promise<EarningsSummary> {
  return apiClient.get<EarningsSummary>("/api/driver/earnings", { period });
}

export async function getPayoutHistory(): Promise<PayoutRecord[]> {
  return apiClient.get<PayoutRecord[]>("/api/driver/earnings/payouts");
}

export async function requestPayout(input: PayoutRequest): Promise<PayoutRecord> {
  return apiClient.post<PayoutRecord>("/api/driver/earnings/payouts", input);
}
