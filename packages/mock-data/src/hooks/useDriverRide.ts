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
export type LiveLocationStatus = "idle" | "acquiring" | "live" | "denied" | "unavailable" | "unsupported";

/** Hard ceiling on a one-shot fix, so callers can never await indefinitely. */
const GET_FIX_TIMEOUT_MS = 10_000;

function readPosition(pos: GeolocationPosition) {
  const heading =
    typeof pos.coords.heading === "number" && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null;
  const accuracy =
    typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined;
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, heading, accuracy };
}

function statusForError(error: GeolocationPositionError): LiveLocationStatus {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  return "unavailable";
}

/**
 * Obtain a single high-accuracy fix and hand it to the backend, à la the
 * "share your location to go online" step every ride-hailing driver app has.
 *
 * The dashboard calls this *before* flipping the driver online. The matching
 * loop only considers drivers whose `locationUpdatedAt` is fresher than
 * LOCATION_STALE_MS (45s), so a driver who toggles online from a device that
 * never reports a fix is stored as `isOnline: true` yet can never be matched to
 * a ride - which is indistinguishable, from the driver's seat, from "the online
 * toggle doesn't work".
 *
 * Rejects with the geolocation error (or an Error when unsupported) so the
 * caller can explain the actual reason instead of failing silently.
 */
export async function acquireAndReportCurrentLocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("This device doesn't support location.");
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    // Our own timer, not just the API's `timeout` option: some browsers never
    // invoke either callback when no positioning provider is available, which
    // would leave the caller awaiting forever.
    const timer = setTimeout(() => reject(new Error("Getting your location timed out.")), GET_FIX_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve(position);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: GET_FIX_TIMEOUT_MS }
    );
  });
  const fix = readPosition(pos);
  await driverRideService.updateDriverLocation(fix.lat, fix.lng, fix.heading ?? undefined, fix.accuracy);
  return { ...fix, accuracy: undefined as number | undefined };
}

/** Push an already-obtained fix to the backend, sparing a fresh GPS lock. */
export async function reportLocationFix(fix: { lat: number; lng: number; heading: number | null }) {
  await driverRideService.updateDriverLocation(fix.lat, fix.lng, fix.heading ?? undefined);
}

/**
 * Watches the device's position and, while `report` is true, streams fixes to
 * the backend - this is what keeps the driver inside the matcher's freshness
 * window and moves their marker for the rider.
 *
 * The watch runs whenever `watch` is true, independently of `report`, so that
 * (a) the permission prompt is resolved before the driver tries to go online,
 * and (b) a position is already cached for the map. Crucially this hook also
 * surfaces *why* tracking isn't working (denied / unavailable / unsupported):
 * the silent `() => {}` error callback it used to have meant the UI happily
 * displayed "Live location" while no fix was ever reaching the server.
 */
export function useReportLiveLocation(watch: boolean, report: boolean = watch, restartToken: number = 0) {
  const [state, setState] = React.useState<{
    position: { lat: number; lng: number; heading: number | null } | null;
    status: LiveLocationStatus;
    lastFixAt: number | null;
  }>({ position: null, status: watch ? "acquiring" : "idle", lastFixAt: null });
  const lastSentRef = React.useRef(0);
  const reportRef = React.useRef(report);
  reportRef.current = report;

  React.useEffect(() => {
    if (!watch) {
      setState((prev) => ({ ...prev, status: "idle" }));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((prev) => ({ ...prev, status: "unsupported" }));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = readPosition(pos);
        setState({
          position: { lat: fix.lat, lng: fix.lng, heading: fix.heading },
          status: "live",
          lastFixAt: Date.now(),
        });
        if (!reportRef.current) return;
        const now = Date.now();
        if (now - lastSentRef.current > LIVE_LOCATION_REPORT_INTERVAL_MS) {
          lastSentRef.current = now;
          driverRideService
            .updateDriverLocation(fix.lat, fix.lng, fix.heading ?? undefined, fix.accuracy)
            .catch(() => {});
        }
      },
      (error) => {
        setState((prev) => ({ ...prev, status: statusForError(error) }));
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // `restartToken` lets the caller tear down and re-establish the watch (e.g.
    // a "retry location" button after the driver has fixed a blocked
    // permission) — a fresh watchPosition is what re-queries permission state.
  }, [watch, restartToken]);

  return state;
}
