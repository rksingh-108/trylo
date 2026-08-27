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

export function useCancelDriverRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, reason }: { rideId: string; reason: string }) =>
      driverRideService.cancelDriverRide(rideId, reason),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.activeDriverRide, null);
    },
  });
}

/** In-app emergency alert only - see driverRideService.triggerDriverSos for what this actually does (and doesn't) do. */
export function useTriggerDriverSos() {
  return useMutation({
    mutationFn: ({ rideId, ...input }: { rideId: string } & driverRideService.TriggerDriverSosInput) =>
      driverRideService.triggerDriverSos(rideId, input),
  });
}

export function useDriverRideHistory() {
  return useQuery({
    queryKey: queryKeys.driverRideHistory,
    queryFn: driverRideService.getDriverRideHistory,
  });
}

// Also used by PremiumMap (packages/ui/src/kinetic/premium-map.tsx) to size
// the live marker's glide duration - keep the two in sync if this changes,
// so the marker's animation finishes roughly as the next fix arrives instead
// of snapping-then-freezing (too short) or still gliding when overtaken by a
// newer fix (too long).
export const LIVE_LOCATION_REPORT_INTERVAL_MS = 3000;

/**
 * Watches the device's real GPS position while `enabled`, returning it immediately
 * for local map display (no need to wait on a server round-trip to see your own
 * position move) and pushing it to the backend at most once every
 * LIVE_LOCATION_REPORT_INTERVAL_MS so the rider can see the driver move live on
 * their own map via the `driver:location` socket event. Returns null if
 * geolocation is unavailable/denied.
 *
 * Also carries `coords.heading` (the device's own GPS/compass-fused bearing,
 * when the browser reports one) alongside the position, both locally and to
 * the backend - this is what lets the live marker actually rotate to face the
 * direction of travel; without it, the map falls back to estimating a
 * heading purely from successive position fixes, which is far less reliable
 * at low speed or through brief stops.
 *
 * Also reports `coords.accuracy` (the fix's own uncertainty radius, in
 * meters) - the backend uses it to avoid treating a low-confidence reading as
 * proof the driver has reached pickup (see POST /api/driver/location's
 * arrival-confirmation check).
 */
export function useReportLiveLocation(enabled: boolean) {
  const [position, setPosition] = React.useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const lastSentRef = React.useRef(0);

  React.useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const heading = typeof pos.coords.heading === "number" && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null;
        const accuracy =
          typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined;
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, heading };
        setPosition(next);
        const now = Date.now();
        if (now - lastSentRef.current > LIVE_LOCATION_REPORT_INTERVAL_MS) {
          lastSentRef.current = now;
          driverRideService.updateDriverLocation(next.lat, next.lng, heading ?? undefined, accuracy).catch(() => {});
        }
      },
      () => {
        // permission denied / unavailable — caller falls back to the last known DB location
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return position;
}
