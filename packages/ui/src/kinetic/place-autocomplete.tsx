"use client";

import * as React from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "../components/input";

export interface PlaceResult {
  description: string;
  placeId: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
};
}

function describe(props: PhotonFeature["properties"]): string {
  const parts = [props.name, props.street, props.city, props.state, props.country].filter(
    (p, i, arr): p is string => Boolean(p) && arr.indexOf(p) === i
  );
  return parts.join(", ");
}

async function searchPhoton(query: string): Promise<PlaceResult[]> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`);
    const data = await res.json();
    const features: PhotonFeature[] = data?.features ?? [];
    return features
      .filter((f) => f.geometry?.coordinates)
      .map((f, i) => ({
        description: describe(f.properties),
        placeId: `${f.properties.osm_type ?? "place"}-${f.properties.osm_id ?? i}-${i}`,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }))
      .filter((p) => p.description);
  } catch {
    return [];
  }
}

export interface PlaceAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /**
   * Whether this field's dropdown is allowed to render. Callers that show
   * more than one PlaceAutocomplete at once (e.g. Pickup + Destination in
   * LocationSearchSheet) must track which field is currently active and
   * pass `open` accordingly, so a field's stale suggestions from an earlier
   * search don't stay mounted - and visually overlapping the other field -
   * after the user has moved on without picking one.
   */
  open: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

/** Location search box backed by Photon (photon.komoot.io) — free, no API key, OpenStreetMap-based. */
export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  autoFocus,
  className,
  open,
  onFocus,
  onBlur,
}: PlaceAutocompleteProps) {
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const requestId = React.useRef(0);

  React.useEffect(() => {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const found = await searchPhoton(value);
      if (requestId.current === id) setResults(found);
    }, 300); // debounced so every keystroke doesn't hit the free search API
    return () => clearTimeout(timer);
  }, [value]);

  function handleSelect(place: PlaceResult) {
    onSelect(place);
    setResults([]);
  }

  return (
    <div className={className}>
      <div className="relative">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder ?? "Search destination"}
            className="pl-11"
          />
        </div>
        {open && results.length > 0 && (
          <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-elevation-3 animate-in fade-in slide-in-from-top-1">
            {results.map((place) => (
              <button
                key={place.placeId}
                type="button"
                // Prevent the input from blurring on click - a mousedown-triggered
                // blur would flip `open` to false (via onBlur) before this button's
                // click handler runs, closing the dropdown out from under the click
                // and silently dropping the selection.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(place)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <MapPin size={16} className="shrink-0 text-muted-foreground" />
                <p className="min-w-0 truncate text-sm font-medium text-foreground">{place.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
