import type { Driver, VehicleType } from "@trylo/types";
import { networkDelay } from "../latency";
import { generateNearbyDrivers } from "../seed";

export async function getNearbyDrivers(vehicleType: VehicleType): Promise<Driver[]> {
  return networkDelay(generateNearbyDrivers(vehicleType), 250, 600);
}
