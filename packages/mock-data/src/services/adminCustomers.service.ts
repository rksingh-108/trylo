import type { AdminCustomerListResult, AdminCustomerSummary, Ride, Wallet } from "@trylo/types";
import { apiClient } from "../apiClient";

export interface AdminCustomerListQuery {
  search?: string;
  page?: number;
  limit?: number;
}

export async function listAdminCustomers(query: AdminCustomerListQuery = {}): Promise<AdminCustomerListResult> {
  return apiClient.get<AdminCustomerListResult>("/api/admin/customers", { ...query });
}

export async function getAdminCustomer(id: string): Promise<AdminCustomerSummary | null> {
  return apiClient.get<AdminCustomerSummary | null>(`/api/admin/customers/${id}`);
}

export async function getAdminCustomerRides(id: string): Promise<Ride[]> {
  return apiClient.get<Ride[]>(`/api/admin/customers/${id}/rides`);
}

export async function getAdminCustomerWallet(id: string): Promise<Wallet> {
  return apiClient.get<Wallet>(`/api/admin/customers/${id}/wallet`);
}

export async function suspendAdminCustomer(id: string, reason?: string): Promise<AdminCustomerSummary> {
  return apiClient.post<AdminCustomerSummary>(`/api/admin/customers/${id}/suspend`, { reason });
}

export async function unsuspendAdminCustomer(id: string): Promise<AdminCustomerSummary> {
  return apiClient.post<AdminCustomerSummary>(`/api/admin/customers/${id}/unsuspend`);
}
