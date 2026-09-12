import type { PayoutRecord } from "@trylo/types";
import { apiClient } from "../apiClient";

export interface AdminPayout extends PayoutRecord {
  driver: { id: string; name: string; phone: string };
}

export async function listAdminPayouts(): Promise<AdminPayout[]> {
  return apiClient.get<AdminPayout[]>("/api/admin/payouts");
}

export async function processPayout(id: string): Promise<PayoutRecord> {
  return apiClient.post<PayoutRecord>(`/api/admin/payouts/${id}/process`);
}

export async function rejectPayout(id: string): Promise<PayoutRecord> {
  return apiClient.post<PayoutRecord>(`/api/admin/payouts/${id}/reject`);
}