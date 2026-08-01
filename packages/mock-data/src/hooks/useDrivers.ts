"use client";

import type { VehicleType } from "@trylo/types";
import { useQuery } from "@tanstack/react-query";
import * as driverDiscoveryService from "../services/driverDiscovery.service";
import { queryKeys } from "./queryKeys";

export function useNearbyDrivers(vehicleType: VehicleType | null) {
  return useQuery({
    queryKey: queryKeys.nearbyDrivers(vehicleType ?? "none"),
    queryFn: () => driverDiscoveryService.getNearbyDrivers(vehicleType!),
    enabled: Boolean(vehicleType),
    staleTime: 15_000,
  });
}
