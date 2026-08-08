"use client";

import type { AdminRideFilter } from "@trylo/types";
import { useQuery } from "@tanstack/react-query";
import * as adminRidesService from "../services/adminRides.service";
import { queryKeys } from "./queryKeys";

export function useAdminRides(filter: AdminRideFilter = {}) {
  return useQuery({
    queryKey: queryKeys.adminRides(JSON.stringify(filter)),
    queryFn: () => adminRidesService.listAdminRides(filter),
  });
}

export function useAdminRide(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminRide(id ?? "none"),
    queryFn: () => adminRidesService.getAdminRide(id!),
    enabled: Boolean(id),
  });
}
