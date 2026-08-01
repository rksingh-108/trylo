export interface EarningsRidePoint {
  rideId: string;
  fare: number;
  distanceKm: number;
  completedAt: string;
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
