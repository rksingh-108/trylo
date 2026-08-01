"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as driverDashboardService from "../services/driverDashboard.service";
import { queryKeys } from "./queryKeys";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: driverDashboardService.getDashboardSummary,
    refetchInterval: 15_000,
  });
}

export function useSetOnlineStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: driverDashboardService.setOnlineStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentDriver });
    },
  });
}
