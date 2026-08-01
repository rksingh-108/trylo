import type { Wallet, WalletTransaction } from "@trylo/types";
import { networkDelay, randomId } from "../latency";
import { customerDb } from "../store";

export async function getWallet(): Promise<Wallet> {
  return networkDelay({ ...customerDb.wallet, transactions: [...customerDb.wallet.transactions] });
}

export async function topUpWallet(amount: number): Promise<Wallet> {
  const txn: WalletTransaction = {
    id: randomId("txn"),
    type: "credit",
    category: "top_up",
    amount,
    description: "Added money via UPI",
    createdAt: new Date().toISOString(),
  };
  customerDb.wallet.balance += amount;
  customerDb.wallet.transactions.unshift(txn);
  return networkDelay({ ...customerDb.wallet, transactions: [...customerDb.wallet.transactions] }, 400, 800);
}
