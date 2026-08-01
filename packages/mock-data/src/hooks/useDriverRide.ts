"use client";

import * as React from "react";
import type { Ride } from "@trylo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as driverRideService from "../services/driverRide.service";
import type { IncomingRequestOffer } from "../services/driverRide.service";
import { queryKeys } from "./queryKeys";
import { useCurrentDriver } from "./useDriverAuth";
import { joinDriverRoom, joinRideRoom, leaveRideRoom, onIncomingRequest, onRequestCleared, onRideUpdated } from "../socketClient";

/**
 * Polls for an incoming request every 1.5s as a fallback, and applies realtime
 * `incoming_request` / `request_cleared` pushes immediately while online.
 */
export function useIncomingRequest(enabled: boolean) {
  const queryClient = useQueryClient();
  const { data: driver } = useCurrentDriver();

  React.useEffect(() => {
    if (!enabled || !driver?.id) return;
    joinDriverRoom(driver.id);
    const unsubscribeIncoming = onIncomingRequest<IncomingRequestOffer>((offer) => {
      queryClient.setQueryData(queryKeys.incomingRequest, offer);
    });
    const unsubscribeCleared = onRequestCleared(() => {
      queryClient.setQueryData(queryKeys.incomingRequest, null);
    });
    return () => {
      unsubscribeIncoming();
      unsubscribeCleared();
    };
  }, [enabled, driver?.id, queryClient]);

  return useQuery({
    queryKey: queryKeys.incomingRequest,
    queryFn: driverRideService.getIncomingRequest,
    enabled,
    refetchInterval: enabled ? 1500 : false,
    refetchIntervalInBackground: true,
  });
}

export function useAcceptRideRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rideId: string) => driverRideService.acceptRideRequest(rideId),
    onSuccess: (ride) => {
      queryClient.setQueryData(queryKeys.incomingRequest, null);
      queryClient.setQueryData(queryKeys.activeDriverRide, ride);
    },
  });
}

export function useRejectRideRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rideId: string) => driverRideService.rejectRideRequest(rideId),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.incomingRequest, null);
    },
  });
}

const TERMINAL_STATUSES: Ride["status"][] = ["completed", "cancelled"];

export function useActiveDriverRide() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.activeDriverRide,
    queryFn: driverRideService.getActiveDriverRide,
    refetchInterval: (q) => {
      const ride = q.state.data as Ride | null | undefined;
      if (!ride || TERMINAL_STATUSES.includes(ride.status)) return false;
      return 2000;
    },
    refetchIntervalInBackground: true,
  });

  const rideId = query.data?.id ?? null;
  React.useEffect(() => {
    if (!rideId) return;
    joinRideRoom(rideId);
    const unsubscribe = onRideUpdated<Ride>((ride) => {
      if (ride.id === rideId) {
        queryClient.setQueryData(queryKeys.activeDriverRide, ride);
      }
    });
    return () => {
      unsubscribe();
      leaveRideRoom(rideId);
    };
  }, [rideId, queryClient]);

  return query;
}

export function useVerifyRiderOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, otp }: { rideId: string; otp: string }) =>
      driverRideService.verifyRiderOtp(rideId, otp),
    onSuccess: (result) => {
      if (result.ride) queryClient.setQueryData(queryKeys.activeDriverRide, result.ride);
    },
  });
}

export function useEndRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rideId: string) => driverRideService.endRide(rideId),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.activeDriverRide, null);
      queryClient.invalidateQueries({ queryKey: queryKeys.driverRideHistory });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

export function useDriverRideHistory() {
  return useQuery({
    queryKey: queryKeys.driverRideHistory,
    queryFn: driverRideService.getDriverRideHistory,
  });
}
