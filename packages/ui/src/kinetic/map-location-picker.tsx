"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, MapPin, X } from "lucide-react";
import { Button } from "../components/button";
import { PremiumMap, type MapGeoPoint } from "./premium-map";
import { reverseGeocode } from "./geocoding";
import { cn } from "../lib/cn";

export interface MapLocationPickerProps {
  initialPoint: MapGeoPoint;
  title?: string;
  onConfirm: (result: { address: string; point: MapGeoPoint }) => void;
  onClose: () => void;
}

/**
 * Full-screen "drag the map to set a point" picker — a fixed center pin stays
 * screen-centered while the map pans underneath it; the point is reverse-geocoded
 * via Nominatim each time the camera settles.
 */
export function MapLocationPicker({ initialPoint, title, onConfirm, onClose }: MapLocationPickerProps) {
  const [center, setCenter] = React.useState<MapGeoPoint>(initialPoint);
  const [address, setAddress] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const requestId = React.useRef(0);

  const handleCenterChange = React.useCallback((point: MapGeoPoint) => {
    setCenter(point);
  }, []);

  React.useEffect(() => {
    const id = ++requestId.current;
    setResolving(true);
    reverseGeocode(center).then((result) => {
      if (requestId.current !== id) return;
      setAddress(result);
      setResolving(false);
    });
  }, [center.lat, center.lng]);

  function handleConfirm() {
    onConfirm({ address: address ?? "Selected location", point: center });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="relative flex-1">
        <PremiumMap
          className="h-full w-full"
          center={initialPoint}
          zoom={16}
          interactive
          showCurrentLocationButton
          onCenterChange={handleCenterChange}
        />

        {/* Fixed center pin — stays screen-centered while the map pans underneath. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="-mt-8 flex flex-col items-center">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-primary shadow-elevation-3 transition-transform",
                resolving && "scale-90"
              )}
            >
              <MapPin size={16} className="text-primary-foreground" fill="currentColor" />
            </span>
            <span className="mt-0.5 h-3 w-0.5 bg-primary" />
          </div>
        </div>

        <div className="absolute left-4 right-4 top-5 z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="glass-strong grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground shadow-elevation-2"
          >
            <X size={18} />
          </button>
          <p className="glass-strong flex-1 truncate rounded-full px-4 py-2.5 text-sm font-medium text-foreground shadow-elevation-2">
            {title ?? "Move the map to set your location"}
          </p>
        </div>
      </div>

      <div className="border-t border-border bg-card px-5 pb-8 pt-4 shadow-elevation-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15">
            <MapPin size={15} className="text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Selected location</p>
            <p className="truncate text-sm font-medium text-foreground">
              {resolving ? "Locating address…" : (address ?? "Unknown location")}
            </p>
          </div>
        </div>
        <Button size="lg" className="mt-4 w-full" disabled={resolving} onClick={handleConfirm}>
          <Check size={18} />
          Confirm location
        </Button>
      </div>
    </motion.div>
  );
}
