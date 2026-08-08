import type { AdminDriverEarningListResult, AdminWalletTransactionListResult } from "@trylo/types";
import { apiClient } from "../apiClient";

export interface AdminWalletTransactionQuery {
  category?: "ride" | "top_up" | "refund" | "payout" | "bonus";
  type?: "credit" | "debit";
  userId?: string;
  page?: number;
  limit?: number;
}

export async function listAdminWalletTransactions(
  query: AdminWalletTransactionQuery = {}
): Promise<AdminWalletTransactionListResult> {
  return apiClient.get<AdminWalletTransactionListResult>("/api/admin/payments/wallet-transactions", { ...query });
}

export interface AdminDriverEarningQuery {
  driverId?: string;
  page?: number;
  limit?: number;
}

export async function listAdminDriverEarnings(
  query: AdminDriverEarningQuery = {}
): Promise<AdminDriverEarningListResult> {
  return apiClient.get<AdminDriverEarningListResult>("/api/admin/payments/driver-earnings", { ...query });
}
