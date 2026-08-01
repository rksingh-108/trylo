"use client";

import * as React from "react";
import type { Ride } from "@trylo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as rideService from "../services/ride.service";
import { queryKeys } from "./queryKeys";
import { joinRideRoom, leaveRideRoom, onRideUpdated } from "../socketClient";

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

/**
 * Polls the ride lifecycle every second as a fallback, and applies realtime `ride:updated`
 * pushes immediately (see packages/mock-data/src/socketClient.ts) once matched to a driver.
 */
export function useRideStatus(rideId: string | null) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!rideId) return;
    joinRideRoom(rideId);
    const unsubscribe = onRideUpdated<Ride>((ride) => {
      if (ride.id === rideId) {
        queryClient.setQueryData(queryKeys.rideStatus(rideId), ride);
      }
    });
    return () => {
      unsubscribe();
      leaveRideRoom(rideId);
    };
  }, [rideId, queryClient]);

  return useQuery({
    queryKey: queryKeys.rideStatus(rideId ?? "none"),
    queryFn: () => rideService.getRideStatus(rideId!),
    enabled: Boolean(rideId),
    refetchInterval: (query) => {
      const ride = query.state.data as Ride | null | undefined;
      if (!ride || TERMINAL_STATUSES.includes(ride.status)) return false;
      return 1000;
    },
    refetchIntervalInBackground: true,
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
