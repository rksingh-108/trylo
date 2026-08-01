import type { PaymentMethod } from "@trylo/types";

export const paymentMethods: PaymentMethod[] = [
  { id: "pm_upi", type: "upi", label: "UPI", detail: "aditi@okhdfcbank", isDefault: true },
  { id: "pm_card", type: "card", label: "HDFC Bank Debit Card", detail: "•••• 4821", isDefault: false },
  { id: "pm_cash", type: "cash", label: "Cash", detail: "Pay the driver directly", isDefault: false },
];
