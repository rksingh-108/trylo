"use client";

import type { EarningsSummary } from "@trylo/types";
import { useQuery } from "@tanstack/react-query";
import * as driverEarningsService from "../services/driverEarnings.service";
import { queryKeys } from "./queryKeys";

export function useDriverEarnings(period: EarningsSummary["period"]) {
  return useQuery({
    queryKey: queryKeys.driverEarnings(period),
    queryFn: () => driverEarningsService.getDriverEarnings(period),
  });
}

export function usePayoutHistory() {
  return useQuery({
    queryKey: queryKeys.payoutHistory,
    queryFn: driverEarningsService.getPayoutHistory,
  });
}
