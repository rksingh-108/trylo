"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as driverDashboardService from "../services/driverDashboard.service";
import type { DashboardSummary } from "../services/driverDashboard.service";
import { queryKeys } from "./queryKeys";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: driverDashboardService.getDashboardSummary,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
}

/**
 * Toggle the driver's availability.
 *
 * The optimistic update is written straight into the cached dashboard summary
 * rather than held in component state. That matters: React Query resolves the
 * mutation as soon as the POST returns, but the invalidated refetch it triggers
 * is a *second*, asynchronous round-trip. If the optimistic value lived in
 * component state and was cleared in `onSuccess`, the component would re-render
 * against the still-stale cached summary (`isOnline: false`) for the duration of
 * that refetch — the switch visibly snapped back to "Offline" before the server
 * data arrived. Writing into the cache means the optimistic value *is* the data,
 * so there is nothing to clear and no stale frame to fall back to.
 */
export function useSetOnlineStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: driverDashboardService.setOnlineStatus,
    onMutate: async (isOnline: boolean) => {
      // Stop an in-flight poll (the 15s refetchInterval) or a previous toggle's
      // refetch from landing mid-flight and clobbering the optimistic value.
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboardSummary });
      const previous = queryClient.getQueryData<DashboardSummary | null>(queryKeys.dashboardSummary);
      if (previous) {
        const next: DashboardSummary = { ...previous, isOnline };
        queryClient.setQueryData(queryKeys.dashboardSummary, next);
      }
      return { previous };
    },
    onError: (_error, _isOnline, context) => {
      // Roll the cache back to exactly what it held before the attempt.
      if (context && context.previous !== undefined) {
        queryClient.setQueryData(queryKeys.dashboardSummary, context.previous);
      }
    },
    // Reconcile with the server once the request has settled, whether it
    // succeeded or failed (the rollback above already handled failure).
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentDriver });
    },
  });
}
