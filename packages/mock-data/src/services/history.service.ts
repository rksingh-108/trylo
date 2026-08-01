import type { Ride } from "@trylo/types";
import { networkDelay } from "../latency";
import { customerDb } from "../store";

export async function getRideHistory(): Promise<Ride[]> {
  return networkDelay([...customerDb.rideHistory]);
}

export async function getRideDetail(rideId: string): Promise<Ride | null> {
  const ride = customerDb.rideHistory.find((r) => r.id === rideId) ?? null;
  return networkDelay(ride);
}
