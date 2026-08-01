"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface MapPoint {
  /** Position as a percentage of the map surface (0-100), not a real projected coordinate. */
  x: number;
  y: number;
}

export interface MapPlaceholderProps {
  className?: string;
  pickup?: MapPoint;
  drop?: MapPoint;
  /** A moving marker, e.g. the driver's live position. */
  liveMarker?: MapPoint;
  showRoute?: boolean;
  children?: React.ReactNode;
}

/**
 * Mock map surface — a styled placeholder standing in for a real maps SDK (Mapbox/Google Maps).
 * TODO(backend): swap for a real map provider; keep the pickup/drop/liveMarker prop contract.
 */
export function MapPlaceholder({ className, pickup, drop, liveMarker, showRoute, children }: MapPlaceholderProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[linear-gradient(135deg,theme(colors.teal.50),theme(colors.neutral.100))]",
        className
      )}
    >
      <svg className="absolute inset-0 h-full w-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kinetic-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-300" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kinetic-grid)" />
        <path d="M -10 30 Q 40 15 60 55 T 130 40" stroke="currentColor" strokeWidth="6" fill="none" className="text-white/70" />
        <path d="M -10 75 Q 50 90 90 60 T 140 80" stroke="currentColor" strokeWidth="5" fill="none" className="text-white/60" />
      </svg>

      {showRoute && pickup && drop && (
        <svg className="absolute inset-0 h-full w-full">
          <line
            x1={`${pickup.x}%`}
            y1={`${pickup.y}%`}
            x2={`${drop.x}%`}
            y2={`${drop.y}%`}
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="8 6"
            className="text-teal-600"
          />
        </svg>
      )}

      {pickup && <MapPin point={pickup} color="bg-amber-500" label="Pickup" />}
      {drop && <MapPin point={drop} color="bg-teal-600" label="Drop" />}
      {liveMarker && <LiveMarker point={liveMarker} />}

      {children}
    </div>
  );
}

function MapPin({ point, color, label }: { point: MapPoint; color: string; label: string }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full"
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
      aria-label={label}
    >
      <div className={cn("h-4 w-4 rounded-full border-2 border-white shadow-md", color)} />
      <div className={cn("mx-auto h-2 w-0.5", color)} />
    </div>
  );
}

function LiveMarker({ point }: { point: MapPoint }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
      aria-label="Live location"
    >
      <span className="absolute inset-0 rounded-full bg-primary/60 animate-pulse-ring" />
      <span className="relative block h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-md" />
    </div>
  );
}
