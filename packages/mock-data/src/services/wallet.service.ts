import type { Wallet } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getWallet(): Promise<Wallet> {
  return apiClient.get<Wallet>("/api/customer/wallet");
}

export async function topUpWallet(amount: number): Promise<Wallet> {
  return apiClient.post<Wallet>("/api/customer/wallet/topup", { amount });
}
