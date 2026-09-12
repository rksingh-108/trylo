"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as driverRideService from "../services/driverRide.service";
import { queryKeys } from "./queryKeys";

export function useRateRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, rating }: { rideId: string; rating: number }) =>
      driverRideService.rateRider(rideId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.driverRideHistory });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeDriverRide });
    },
  });
}