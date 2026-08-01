import type { PaymentMethod } from "@trylo/types";
import { networkDelay } from "../latency";
import { paymentMethods } from "../seed";

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return networkDelay([...paymentMethods]);
}
