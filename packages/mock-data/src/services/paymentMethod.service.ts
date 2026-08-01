import type { PaymentMethod } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return apiClient.get<PaymentMethod[]>("/api/customer/payment-methods");
}
