"use client";

import * as React from "react";
import { LocateFixed, Map as MapIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { PlaceAutocomplete, type PlaceResult } from "./place-autocomplete";
import { cn } from "../lib/cn";

export interface LocationSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickupValue: string;
  onPickupQueryChange: (value: string) => void;
  onPickupSelect: (place: PlaceResult) => void;
  dropValue: string;
  onDropQueryChange: (value: string) => void;
  onDropSelect: (place: PlaceResult) => void;
  /** Which field should be focused when the sheet opens. */
  autoFocus?: "pickup" | "drop";
  onUseCurrentLocation: () => void;
  onChooseOnMap: () => void;
  usingCurrentLocation?: boolean;
  title?: string;
  /** Extra content rendered below the two search fields — e.g. saved places. */
  children?: React.ReactNode;
}

/** Uber-style pickup + destination search sheet: both fields editable, plus quick pickup actions. */
export function LocationSearchSheet({
  open,
  onOpenChange,
  pickupValue,
  onPickupQueryChange,
  onPickupSelect,
  dropValue,
  onDropQueryChange,
  onDropSelect,
  autoFocus,
  onUseCurrentLocation,
  onChooseOnMap,
  usingCurrentLocation,
  title = "Plan your ride",
  children,
}: LocationSearchSheetProps) {
  // Tracks which of the two fields is currently focused, so only that one's
  // dropdown is allowed to render - otherwise a field's leftover suggestions
  // from an earlier search stay mounted after the user moves to the other
  // field without picking one, and (being absolutely positioned right below
  // the input) visually overlap and intercept clicks meant for it.
  const [activeField, setActiveField] = React.useState<"pickup" | "drop" | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex gap-3">
          <div className="flex shrink-0 flex-col items-center pt-3.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="my-1 h-9 w-px flex-1 border-l border-dashed border-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
          </div>
          <div className="flex-1 space-y-2.5">
            <PlaceAutocomplete
              value={pickupValue}
              onChange={onPickupQueryChange}
              onSelect={onPickupSelect}
              placeholder="Pickup location"
              autoFocus={autoFocus === "pickup"}
              open={activeField === "pickup"}
              onFocus={() => setActiveField("pickup")}
              onBlur={() => setActiveField((field) => (field === "pickup" ? null : field))}
            />
            <PlaceAutocomplete
              value={dropValue}
              onChange={onDropQueryChange}
              onSelect={onDropSelect}
              placeholder="Where to?"
              autoFocus={autoFocus === "drop"}
              open={activeField === "drop"}
              onFocus={() => setActiveField("drop")}
              onBlur={() => setActiveField((field) => (field === "drop" ? null : field))}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onUseCurrentLocation}
            className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <LocateFixed size={16} className={cn("shrink-0 text-primary", usingCurrentLocation && "animate-pulse")} />
            <span className="truncate text-xs font-medium text-foreground">
              {usingCurrentLocation ? "Locating…" : "Current location"}
            </span>
          </button>
          <button
            type="button"
            onClick={onChooseOnMap}
            className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <MapIcon size={16} className="shrink-0 text-primary" />
            <span className="truncate text-xs font-medium text-foreground">Choose on map</span>
          </button>
        </div>

        {children}
      </SheetContent>
    </Sheet>
  );
}
