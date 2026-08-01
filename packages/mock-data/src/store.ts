import type { Driver, KycDocument, Ride, User, Wallet, WalletTransaction } from "@trylo/types";
import { randomId } from "./latency";

/**
 * In-memory mock "database" for the browser session. Resets on reload — this is a stand-in
 * for a real backend, not persistence. Every mock service function reads/writes through here.
 */

function seedWalletTransactions(): WalletTransaction[] {
  return [
    { id: randomId("txn"), type: "credit", category: "top_up", amount: 500, description: "Added money via UPI", createdAt: daysAgo(6) },
    { id: randomId("txn"), type: "debit", category: "ride", amount: 128, description: "Ride to Koramangala 5th Block", createdAt: daysAgo(5) },
    { id: randomId("txn"), type: "debit", category: "ride", amount: 84, description: "Ride to MG Road", createdAt: daysAgo(3) },
    { id: randomId("txn"), type: "credit", category: "refund", amount: 45, description: "Refund for cancelled ride", createdAt: daysAgo(2) },
    { id: randomId("txn"), type: "credit", category: "bonus", amount: 25, description: "Referral bonus", createdAt: daysAgo(1) },
  ];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const customerDb: {
  user: User | null;
  wallet: Wallet;
  rideHistory: Ride[];
  activeRide: Ride | null;
} = {
  user: null,
  wallet: {
    balance: 358,
    currency: "INR",
    transactions: seedWalletTransactions(),
  },
  rideHistory: [],
  activeRide: null,
};

export const driverDb: {
  driver: Driver | null;
  kycDocuments: KycDocument[];
  isOnline: boolean;
  onlineSince: string | null;
  incomingRequest: Ride | null;
  incomingRequestExpiresAt: string | null;
  activeRide: Ride | null;
  rideHistory: Ride[];
} = {
  driver: null,
  kycDocuments: [
    { id: "kyc_license", type: "license", label: "Driving License", status: "not_uploaded" },
    { id: "kyc_rc", type: "rc", label: "Vehicle RC", status: "not_uploaded" },
    { id: "kyc_insurance", type: "insurance", label: "Insurance", status: "not_uploaded" },
    { id: "kyc_photo", type: "profile_photo", label: "Profile Photo", status: "not_uploaded" },
  ],
  isOnline: false,
  onlineSince: null,
  incomingRequest: null,
  incomingRequestExpiresAt: null,
  activeRide: null,
  rideHistory: [],
};
