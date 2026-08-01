export interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  category: "ride" | "top_up" | "refund" | "payout" | "bonus";
  amount: number;
  description: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  currency: "INR";
  transactions: WalletTransaction[];
}
