import type { SupportTicket } from "@trylo/types";
import { apiClient } from "../apiClient";

export interface CreateSupportTicketInput {
  subject: string;
  message: string;
}

export async function getMySupportTickets(role: "customer" | "driver"): Promise<SupportTicket[]> {
  return apiClient.get<SupportTicket[]>(`/api/${role}/support`);
}

export async function createSupportTicket(
  role: "customer" | "driver",
  input: CreateSupportTicketInput
): Promise<SupportTicket> {
  return apiClient.post<SupportTicket>(`/api/${role}/support`, input);
}