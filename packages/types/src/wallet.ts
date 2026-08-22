export interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  category: "ride" | "top_up" | "refund" | "payout" | "bonus" | "cancellation_fee";
  amount: number;
  description: string;
  createdAt: string;
  /** Present on the 'ride' category debit created when a ride's fare is settled. */
  rideId?: string;
}

export interface Wallet {
  balance: number;
  currency: "INR";
  transactions: WalletTransaction[];
}
