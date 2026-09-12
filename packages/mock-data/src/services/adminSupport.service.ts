import type { AdminSupportTicket, SupportTicket } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function listAdminSupportTickets(): Promise<AdminSupportTicket[]> {
  return apiClient.get<AdminSupportTicket[]>("/api/admin/support");
}

export async function resolveSupportTicket(id: string): Promise<SupportTicket> {
  return apiClient.post<SupportTicket>(`/api/admin/support/${id}/resolve`);
}