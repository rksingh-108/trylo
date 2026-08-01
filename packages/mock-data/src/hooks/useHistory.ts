"use client";

import { useQuery } from "@tanstack/react-query";
import * as historyService from "../services/history.service";
import { queryKeys } from "./queryKeys";

export function useRideHistory() {
  return useQuery({
    queryKey: queryKeys.rideHistory,
    queryFn: historyService.getRideHistory,
  });
}

export function useRideDetail(rideId: string | null) {
  return useQuery({
    queryKey: queryKeys.rideDetail(rideId ?? "none"),
    queryFn: () => historyService.getRideDetail(rideId!),
    enabled: Boolean(rideId),
  });
}
