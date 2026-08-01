export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  rating: number;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  type: "upi" | "card" | "cash";
  label: string;
  detail: string;
  isDefault: boolean;
}
