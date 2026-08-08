"use client";

import type { AnalyticsPeriod } from "@trylo/types";
import { useQuery } from "@tanstack/react-query";
import * as adminAnalyticsService from "../services/adminAnalytics.service";
import { queryKeys } from "./queryKeys";

export function useAdminRidesTrend(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: queryKeys.adminRidesTrend(period),
    queryFn: () => adminAnalyticsService.getAdminRidesTrend(period),
  });
}

export function useAdminRevenueTrend(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: queryKeys.adminRevenueTrend(period),
    queryFn: () => adminAnalyticsService.getAdminRevenueTrend(period),
  });
}

export function useAdminPaymentSuccessRate() {
  return useQuery({
    queryKey: queryKeys.adminPaymentSuccessRate,
    queryFn: adminAnalyticsService.getAdminPaymentSuccessRate,
  });
}
