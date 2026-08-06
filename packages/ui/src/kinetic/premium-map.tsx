"use client";

import * as React from "react";
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { motion } from "framer-motion";
import { LocateFixed, MapPin as MapPinIcon, Navigation } from "lucide-react";
import { cn } from "../lib/cn";

export interface MapGeoPoint {
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

export interface PremiumMapProps {
  className?: string;
  pickup?: MapGeoPoint;
  drop?: MapGeoPoint;
  /** A moving marker, e.g. the driver's live position. Animates smoothly between updates. */
  liveMarker?: MapGeoPoint;
  showRoute?: boolean;
  /** Fallback center when no pickup/drop is set yet. */
  center?: MapGeoPoint;
  zoom?: number;
  interactive?: boolean;
  showCurrentLocationButton?: boolean;
  onRouteInfo?: (info: RouteInfo) => void;
  mapId?: string;
  children?: React.ReactNode;
}

const DEFAULT_CENTER: MapGeoPoint = { lat: 12.9716, lng: 77.5946 };

/** Interpolates a marker's position smoothly between prop updates instead of snapping. */
function useSmoothPosition(target: MapGeoPoint | undefined, durationMs = 900) {
  const [pos, setPos] = React.useState(target);
  const frame = React.useRef<number | undefined>(undefined);
  const from = React.useRef(target);

  React.useEffect(() => {
    if (!target) {
      setPos(undefined);
      return;
    }
    const start = from.current ?? target;
    const startTime = performance.now();
    if (frame.current) cancelAnimationFrame(frame.current);

    function tick(now: number) {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setPos({
        lat: start.lat + (target!.lat - start.lat) * eased,
        lng: start.lng + (target!.lng - start.lng) * eased,
      });
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    }
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, durationMs]);

  return pos;
}

/** Decodes a Google encoded polyline string into a lat/lng path. */
function decodePolyline(encoded: string): MapGeoPoint[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: MapGeoPoint[] = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coordinates;
}

/**
 * Fetches a driving route from the Routes API (routes.googleapis.com) — the
 * current, actively-supported Google routing API. Deliberately NOT the legacy
 * google.maps.DirectionsService: it's being phased toward this same Routes
 * API by Google itself, and a project may have one enabled without the other.
 */
async function fetchRoute(
  pickup: MapGeoPoint,
  drop: MapGeoPoint,
  apiKey: string
): Promise<{ path: MapGeoPoint[]; distanceKm: number; durationMin: number } | null> {
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: pickup.lat, longitude: pickup.lng } } },
        destination: { location: { latLng: { latitude: drop.lat, longitude: drop.lng } } },
        travelMode: "DRIVE",
      }),
    });
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return null;
    return {
      path: decodePolyline(route.polyline.encodedPolyline),
      distanceKm: Math.round(((route.distanceMeters ?? 0) / 1000) * 10) / 10,
      durationMin: Math.round(parseInt(route.duration ?? "0", 10) / 60),
    };
  } catch {
    return null;
  }
}

function RoutePolyline({
  pickup,
  drop,
  onRouteInfo,
}: {
  pickup: MapGeoPoint;
  drop: MapGeoPoint;
  onRouteInfo?: (info: RouteInfo) => void;
}) {
  const map = useMap();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const polylineRef = React.useRef<google.maps.Polyline | null>(null);

  React.useEffect(() => {
    if (!map || !window.google || !apiKey) return;
    let cancelled = false;

    fetchRoute(pickup, drop, apiKey).then((route) => {
      if (cancelled || !route) return;

      polylineRef.current?.setMap(null);
      polylineRef.current = new google.maps.Polyline({
        path: route.path,
        strokeColor: "#FF7A1A",
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });

      onRouteInfo?.({ distanceKm: route.distanceKm, durationMin: route.durationMin });

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(drop);
      map.fitBounds(bounds, 72);
    });

    return () => {
      cancelled = true;
      polylineRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, apiKey, pickup.lat, pickup.lng, drop.lat, drop.lng]);

  return null;
}

function CurrentLocationButton() {
  const map = useMap();
  const [locating, setLocating] = React.useState(false);

  function handleClick() {
    if (!navigator.geolocation || !map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        map.setZoom(16);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 6000 }
    );
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.92 }}
      className="glass-strong grid h-11 w-11 place-items-center rounded-full text-foreground shadow-elevation-3"
      aria-label="Use current location"
    >
      <LocateFixed size={18} className={cn(locating && "animate-pulse")} />
    </motion.button>
  );
}

function Pin({ tone, label }: { tone: "pickup" | "drop"; label: string }) {
  return (
    <div className="relative -translate-y-1/2" aria-label={label}>
      <div
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full border-2 border-white shadow-elevation-2",
          tone === "pickup" ? "bg-amber-500" : "bg-teal-600"
        )}
      >
        {tone === "pickup" ? (
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        ) : (
          <MapPinIcon size={14} className="fill-white text-white" />
        )}
      </div>
      <div
        className={cn(
          "mx-auto h-2 w-0.5",
          tone === "pickup" ? "bg-amber-500" : "bg-teal-600"
        )}
      />
    </div>
  );
}

function LiveDot() {
  return (
    <div className="relative" aria-label="Live location">
      <span className="absolute inset-0 -m-2 rounded-full bg-primary/50 animate-pulse-ring" />
      <span className="relative grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-primary shadow-elevation-2">
        <Navigation size={11} className="fill-white text-white" />
      </span>
    </div>
  );
}

function MapKeyMissing({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-muted to-muted/50 px-6 text-center",
        className
      )}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-background/80 shadow-elevation-1">
        <MapPinIcon size={22} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">Live map unavailable</p>
      <p className="max-w-[220px] text-xs text-muted-foreground">
        Add <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[10px]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable
        the live map.
      </p>
    </div>
  );
}

/**
 * Real Google Maps surface. Renders a clear "add your API key" state instead of the map
 * when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is unset — never crashes, never shows a blank tile grid.
 */
export function PremiumMap({
  className,
  pickup,
  drop,
  liveMarker,
  showRoute,
  center,
  zoom = 15,
  interactive = true,
  showCurrentLocationButton = true,
  onRouteInfo,
  // "DEMO_MAP_ID" is Google's own testing map id — it lets AdvancedMarker work
  // without requiring a Cloud Console-configured Map ID. Fine for dev; for a
  // real production deploy, create a real Map ID in Cloud Console and pass it.
  mapId = "DEMO_MAP_ID",
  children,
}: PremiumMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const smoothLive = useSmoothPosition(liveMarker);
  const mapCenter = center ?? pickup ?? drop ?? DEFAULT_CENTER;

  if (!apiKey) {
    return <MapKeyMissing className={className} />;
  }

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          mapId={mapId}
          defaultCenter={mapCenter}
          defaultZoom={zoom}
          gestureHandling={interactive ? "greedy" : "none"}
          disableDefaultUI
          zoomControl={interactive}
          className="h-full w-full"
        >
          {pickup && (
            <AdvancedMarker position={pickup}>
              <Pin tone="pickup" label="Pickup" />
            </AdvancedMarker>
          )}
          {drop && (
            <AdvancedMarker position={drop}>
              <Pin tone="drop" label="Drop" />
            </AdvancedMarker>
          )}
          {smoothLive && (
            <AdvancedMarker position={smoothLive}>
              <LiveDot />
            </AdvancedMarker>
          )}
          {showRoute && pickup && drop && (
            <RoutePolyline pickup={pickup} drop={drop} onRouteInfo={onRouteInfo} />
          )}
        </GoogleMap>

        {showCurrentLocationButton && (
          <div className="absolute bottom-4 right-4 z-10">
            <CurrentLocationButton />
          </div>
        )}
      </APIProvider>

      {children}
    </div>
  );
}
