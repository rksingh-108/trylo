import type { EarningsSummary, PayoutRecord } from "@trylo/types";
import { networkDelay, randomId } from "../latency";
import { driverDb } from "../store";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export async function getDriverEarnings(period: EarningsSummary["period"]): Promise<EarningsSummary> {
  const windowDays = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  const rides = driverDb.rideHistory.filter((r) => {
    if (!r.completedAt) return false;
    return new Date(r.completedAt).getTime() >= cutoff;
  });

  return networkDelay({
    period,
    totalEarnings: rides.reduce((sum, r) => sum + r.fare.total, 0),
    totalRides: rides.length,
    totalDistanceKm: Math.round(rides.reduce((sum, r) => sum + r.distanceKm, 0) * 10) / 10,
    onlineHours: Math.round((rides.length * 0.6 + Math.random() * 2) * 10) / 10,
    rides: rides.map((r) => ({
      rideId: r.id,
      fare: r.fare.total,
      distanceKm: r.distanceKm,
      completedAt: r.completedAt!,
    })),
  });
}

const mockPayouts: PayoutRecord[] = [
  { id: randomId("payout"), amount: 4250, status: "processed", bankAccountLast4: "4821", initiatedAt: daysAgo(7), processedAt: daysAgo(6) },
  { id: randomId("payout"), amount: 3890, status: "processed", bankAccountLast4: "4821", initiatedAt: daysAgo(14), processedAt: daysAgo(13) },
  { id: randomId("payout"), amount: 5120, status: "processed", bankAccountLast4: "4821", initiatedAt: daysAgo(21), processedAt: daysAgo(20) },
];

export async function getPayoutHistory(): Promise<PayoutRecord[]> {
  return networkDelay([...mockPayouts]);
}
