import type { Driver } from "@trylo/types";
import { networkDelay } from "../latency";
import { driverDb } from "../store";

export async function setOnlineStatus(isOnline: boolean): Promise<Driver> {
  if (!driverDb.driver) throw new Error("No authenticated driver");
  driverDb.isOnline = isOnline;
  driverDb.onlineSince = isOnline ? new Date().toISOString() : null;
  if (!isOnline) {
    driverDb.incomingRequest = null;
    driverDb.incomingRequestExpiresAt = null;
  }
  driverDb.driver = { ...driverDb.driver, isOnline };
  return networkDelay(driverDb.driver, 250, 500);
}

export interface DashboardSummary {
  driver: Driver;
  isOnline: boolean;
  todayEarnings: number;
  todayRides: number;
  onlineMinutes: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  if (!driverDb.driver) return networkDelay(null);
  const todayRides = driverDb.rideHistory.filter((r) => {
    const completed = r.completedAt ? new Date(r.completedAt) : null;
    return completed && isSameDay(completed, new Date());
  });
  const onlineMinutes = driverDb.onlineSince
    ? Math.floor((Date.now() - new Date(driverDb.onlineSince).getTime()) / 60000)
    : 0;

  return networkDelay({
    driver: driverDb.driver,
    isOnline: driverDb.isOnline,
    todayEarnings: todayRides.reduce((sum, r) => sum + r.fare.total, 0),
    todayRides: todayRides.length,
    onlineMinutes,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}
