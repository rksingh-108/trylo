import { apiClient } from "../apiClient";

export interface AdminPromo {
  id: string;
  code: string;
  discountPercent: number;
  maxDiscount: number | null;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreatePromoInput {
  code: string;
  discountPercent: number;
  maxDiscount?: number;
  active?: boolean;
}

export interface UpdatePromoInput {
  discountPercent?: number;
  maxDiscount?: number | null;
  active?: boolean;
}

export async function listAdminPromos(): Promise<AdminPromo[]> {
  return apiClient.get<AdminPromo[]>("/api/admin/promos");
}

export async function createAdminPromo(input: CreatePromoInput): Promise<AdminPromo> {
  return apiClient.post<AdminPromo>("/api/admin/promos", input);
}

export async function updateAdminPromo(id: string, input: UpdatePromoInput): Promise<AdminPromo> {
  return apiClient.patch<AdminPromo>(`/api/admin/promos/${id}`, input);
}