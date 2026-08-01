"use client";

import type { Ride } from "@trylo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as driverRideService from "../services/driverRide.service";
import { queryKeys } from "./queryKeys";

export function useIncomingRequest(enabled: boolean) {
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
  return useQuery({
    queryKey: queryKeys.activeDriverRide,
    queryFn: driverRideService.getActiveDriverRide,
    refetchInterval: (query) => {
      const ride = query.state.data as Ride | null | undefined;
      if (!ride || TERMINAL_STATUSES.includes(ride.status)) return false;
      return 2000;
    },
    refetchIntervalInBackground: true,
  });
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
