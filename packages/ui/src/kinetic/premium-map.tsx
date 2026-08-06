"use client";

import * as React from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { renderToStaticMarkup } from "react-dom/server";
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
  /** Unused with MapLibre (kept for backward-compat call sites); no-op. */
  mapId?: string;
  children?: React.ReactNode;
}

const DEFAULT_CENTER: MapGeoPoint = { lat: 12.9716, lng: 77.5946 };

// OpenFreeMap's "Liberty" style — free, no API key, no usage limits.
// https://openfreemap.org
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const ROUTE_SOURCE_ID = "trylo-route";
const ROUTE_LAYER_ID = "trylo-route-line";

function toLngLat(p: MapGeoPoint): [number, number] {
  return [p.lng, p.lat];
}

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

function pinHtml(tone: "pickup" | "drop"): string {
  const dotColor = tone === "pickup" ? "background-color:#f59e0b" : "background-color:#0d9488";
  const inner =
    tone === "pickup"
      ? `<span style="height:10px;width:10px;border-radius:9999px;background:#fff;display:block"></span>`
      : renderToStaticMarkup(<MapPinIcon size={14} color="#fff" fill="#fff" />);
  return `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-50%)">
      <div style="display:grid;place-items:center;height:32px;width:32px;border-radius:9999px;border:2px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.25);${dotColor}">
        ${inner}
      </div>
      <div style="margin:0 auto;height:8px;width:2px;${dotColor}"></div>
    </div>
  `;
}

function liveDotHtml(): string {
  const icon = renderToStaticMarkup(<Navigation size={11} color="#fff" fill="#fff" />);
  return `
    <div style="position:relative">
      <span class="trylo-pulse-ring" style="position:absolute;inset:-8px;border-radius:9999px;background:hsl(var(--primary) / 0.5)"></span>
      <span style="position:relative;display:grid;place-items:center;height:24px;width:24px;border-radius:9999px;border:2px solid white;background:hsl(var(--primary));box-shadow:0 4px 14px rgba(0,0,0,0.25)">
        ${icon}
      </span>
    </div>
  `;
}

/** Decodes an OSRM GeoJSON route response into a path + distance/duration. */
async function fetchOsrmRoute(
  pickup: MapGeoPoint,
  drop: MapGeoPoint
): Promise<{ path: MapGeoPoint[]; distanceKm: number; durationMin: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) return null;
    const path: MapGeoPoint[] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
    return {
      path,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}

/** Adds/updates a single marker on the map, reusing the same Marker instance across position updates. */
function useMapMarker(
  map: maplibregl.Map | null,
  ready: boolean,
  position: MapGeoPoint | undefined,
  html: string,
  anchor: "bottom" | "center"
) {
  const markerRef = React.useRef<maplibregl.Marker | null>(null);

  React.useEffect(() => {
    if (!map || !ready) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = html;
      markerRef.current = new maplibregl.Marker({ element: el.firstElementChild as HTMLElement, anchor })
        .setLngLat(toLngLat(position))
        .addTo(map);
    } else {
      markerRef.current.setLngLat(toLngLat(position));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, position?.lat, position?.lng]);

  React.useEffect(
    () => () => {
      markerRef.current?.remove();
      markerRef.current = null;
    },
    [map]
  );
}

function CurrentLocationButton({ map }: { map: maplibregl.Map | null }) {
  const [locating, setLocating] = React.useState(false);

  function handleClick() {
    if (!navigator.geolocation || !map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16, duration: 800 });
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
      <p className="text-sm font-medium text-foreground">Map failed to load</p>
      <p className="max-w-[220px] text-xs text-muted-foreground">Check your internet connection and try again.</p>
    </div>
  );
}

/**
 * Real interactive map built on MapLibre GL JS + OpenFreeMap vector tiles — fully
 * free, no API key, no usage limits. Route/ETA via the public OSRM routing API.
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
  children,
}: PremiumMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const [map, setMap] = React.useState<maplibregl.Map | null>(null);
  const [ready, setReady] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  const smoothLive = useSmoothPosition(liveMarker);
  const mapCenter = center ?? pickup ?? drop ?? DEFAULT_CENTER;
  const initialCenterRef = React.useRef(mapCenter);

  // Initialize the map once.
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: toLngLat(initialCenterRef.current),
        zoom,
        attributionControl: false,
        interactive,
      });
    } catch {
      setLoadError(true);
      return;
    }

    instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    if (interactive) {
      instance.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    }
    instance.on("load", () => setReady(true));
    instance.on("error", () => setLoadError(true));

    mapRef.current = instance;
    setMap(instance);

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapMarker(map, ready, pickup, pinHtml("pickup"), "bottom");
  useMapMarker(map, ready, drop, pinHtml("drop"), "bottom");
  useMapMarker(map, ready, smoothLive, liveDotHtml(), "center");

  // Route + ETA via OSRM, drawn as a GeoJSON line layer.
  React.useEffect(() => {
    if (!map || !ready) return;

    if (!showRoute || !pickup || !drop) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      return;
    }

    let cancelled = false;
    fetchOsrmRoute(pickup, drop).then((route) => {
      if (cancelled || !route || !map.isStyleLoaded()) return;

      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: route.path.map(toLngLat) },
      };

      const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
      } else {
        map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: geojson });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#f97316", "line-width": 5, "line-opacity": 0.95 },
        });
      }

      onRouteInfo?.({ distanceKm: route.distanceKm, durationMin: route.durationMin });

      const bounds = new maplibregl.LngLatBounds(toLngLat(pickup), toLngLat(pickup));
      bounds.extend(toLngLat(drop));
      map.fitBounds(bounds, { padding: 72, duration: 800 });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, showRoute, pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]);

  // Follow a single point (no route in play) — e.g. the driver's own live position,
  // or the rider's current location before a destination is chosen.
  const followTarget = !drop ? (smoothLive ?? center ?? pickup) : undefined;
  React.useEffect(() => {
    if (!map || !ready || !followTarget) return;
    map.flyTo({ center: toLngLat(followTarget), duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, followTarget?.lat, followTarget?.lng]);

  if (loadError) {
    return <MapKeyMissing className={className} />;
  }

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <style>{`
        .trylo-pulse-ring { animation: trylo-pulse-ring 1.8s cubic-bezier(0.4,0,0.2,1) infinite; }
        @keyframes trylo-pulse-ring { 0% { transform: scale(0.8); opacity: 0.8; } 80%,100% { transform: scale(1.8); opacity: 0; } }
        .maplibregl-ctrl-attrib { font-size: 10px; }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />

      {showCurrentLocationButton && (
        <div className="absolute bottom-4 right-4 z-10">
          <CurrentLocationButton map={map} />
        </div>
      )}

      {children}
    </div>
  );
}
