"use client";

import type { PayoutRequest } from "@trylo/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as driverEarningsService from "../services/driverEarnings.service";
import { queryKeys } from "./queryKeys";

export function useRequestPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PayoutRequest) => driverEarningsService.requestPayout(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payoutHistory });
      queryClient.invalidateQueries({ queryKey: queryKeys.driverEarnings("daily") });
    },
  });
}