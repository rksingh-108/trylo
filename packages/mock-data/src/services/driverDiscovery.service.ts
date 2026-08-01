import type { Driver, VehicleType } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getNearbyDrivers(vehicleType: VehicleType): Promise<Driver[]> {
  return apiClient.get<Driver[]>("/api/customer/nearby-drivers", { vehicleType });
}
