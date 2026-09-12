"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as adminPromosService from "../services/adminPromos.service";
import { queryKeys } from "./queryKeys";

export function useAdminPromos() {
  return useQuery({
    queryKey: queryKeys.adminPromos,
    queryFn: adminPromosService.listAdminPromos,
  });
}

export function useCreateAdminPromo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: adminPromosService.CreatePromoInput) => adminPromosService.createAdminPromo(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPromos });
    },
  });
}

export function useUpdateAdminPromo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: adminPromosService.UpdatePromoInput }) =>
      adminPromosService.updateAdminPromo(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPromos });
    },
  });
}