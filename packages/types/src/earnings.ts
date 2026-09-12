export interface EarningsRidePoint {
  rideId: string;
  fare: number;
  /** Tip settled to the driver for this ride (0 if none). */
  tip: number;
  distanceKm: number;
  completedAt: string;
}

export interface PayoutRequest {
  amount: number;
  bankAccountLast4: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
}

export interface AdminSupportTicket extends SupportTicket {
  owner: {
    role: "customer" | "driver";
    name: string;
    phone: string;
  };
}

export interface EarningsSummary {
  period: "daily" | "weekly" | "monthly";
  totalEarnings: number;
  totalRides: number;
  totalDistanceKm: number;
  onlineHours: number;
  rides: EarningsRidePoint[];
}

export interface PayoutRecord {
  id: string;
  amount: number;
  status: "processed" | "pending" | "failed";
  bankAccountLast4: string;
  initiatedAt: string;
  processedAt?: string;
}
