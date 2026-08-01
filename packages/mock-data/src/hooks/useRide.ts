"use client";

import type { Ride } from "@trylo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as rideService from "../services/ride.service";
import { queryKeys } from "./queryKeys";

export function useActiveRide() {
  return useQuery({
    queryKey: queryKeys.activeRide,
    queryFn: rideService.getActiveRide,
  });
}

export function useCreateRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rideService.createRide,
    onSuccess: (ride) => {
      queryClient.setQueryData(queryKeys.activeRide, ride);
      queryClient.setQueryData(queryKeys.rideStatus(ride.id), ride);
    },
  });
}

const TERMINAL_STATUSES: Ride["status"][] = ["completed", "cancelled"];

/** Polls the simulated ride lifecycle every second until the ride reaches a terminal status. */
export function useRideStatus(rideId: string | null) {
  return useQuery({
    queryKey: queryKeys.rideStatus(rideId ?? "none"),
    queryFn: () => rideService.getRideStatus(rideId!),
    enabled: Boolean(rideId),
    refetchInterval: (query) => {
      const ride = query.state.data as Ride | null | undefined;
      if (!ride || TERMINAL_STATUSES.includes(ride.status)) return false;
      return 1000;
    },
  });
}

export function useCancelRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, reason }: { rideId: string; reason: string }) =>
      rideService.cancelRide(rideId, reason),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.activeRide, null);
      queryClient.invalidateQueries({ queryKey: queryKeys.rideHistory });
    },
  });
}

export function useCompleteRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rideId: string) => rideService.completeRide(rideId),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.activeRide, null);
      queryClient.invalidateQueries({ queryKey: queryKeys.rideHistory });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

export function useRateRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, rating, tip }: { rideId: string; rating: number; tip?: number }) =>
      rideService.rateRide(rideId, rating, tip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rideHistory });
    },
  });
}
