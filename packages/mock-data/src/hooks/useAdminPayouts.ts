"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as adminPayoutsService from "../services/adminPayouts.service";
import { queryKeys } from "./queryKeys";

export function useAdminPayouts() {
  return useQuery({
    queryKey: queryKeys.adminPayouts,
    queryFn: adminPayoutsService.listAdminPayouts,
  });
}

export function useProcessPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPayoutsService.processPayout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPayouts });
    },
  });
}

export function useRejectPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPayoutsService.rejectPayout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPayouts });
    },
  });
}