"use client";

import * as React from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, Search } from "lucide-react";
import { cn } from "../lib/cn";
import { Input } from "../components/input";

export interface PlaceResult {
  description: string;
  placeId: string;
  lat: number;
  lng: number;
}

function AutocompleteInner({
  value,
  onChange,
  onSelect,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const places = useMapsLibrary("places");
  const [predictions, setPredictions] = React.useState<google.maps.places.AutocompletePrediction[]>([]);
  const autocompleteService = React.useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = React.useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = React.useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  React.useEffect(() => {
    if (!places) return;
    autocompleteService.current = new places.AutocompleteService();
    sessionToken.current = new places.AutocompleteSessionToken();
    placesService.current = new places.PlacesService(document.createElement("div"));
  }, [places]);

  React.useEffect(() => {
    if (!autocompleteService.current || !value.trim()) {
      setPredictions([]);
      return;
    }
    autocompleteService.current.getPlacePredictions(
      { input: value, sessionToken: sessionToken.current ?? undefined },
      (results) => setPredictions(results ?? [])
    );
  }, [value]);

  function handleSelect(prediction: google.maps.places.AutocompletePrediction) {
    placesService.current?.getDetails(
      { placeId: prediction.place_id, fields: ["geometry", "formatted_address", "name"] },
      (result) => {
        const loc = result?.geometry?.location;
        if (!loc) return;
        onSelect({
          description: result?.formatted_address ?? prediction.description,
          placeId: prediction.place_id,
          lat: loc.lat(),
          lng: loc.lng(),
        });
        setPredictions([]);
      }
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Search destination"}
          className="pl-11"
        />
      </div>
      {predictions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-elevation-3 animate-in fade-in slide-in-from-top-1">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => handleSelect(p)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
            >
              <MapPin size={16} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.structured_formatting?.main_text ?? p.description}
                </p>
                {p.structured_formatting?.secondary_text && (
                  <p className="truncate text-xs text-muted-foreground">{p.structured_formatting.secondary_text}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface PlaceAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/** Google Places Autocomplete search box. Falls back to a plain text input if no Maps API key is set. */
export function PlaceAutocomplete({ className, ...props }: PlaceAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className={cn("relative", className)}>
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder ?? "Search destination"}
          className="pl-11"
        />
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className={className}>
        <AutocompleteInner {...props} />
      </div>
    </APIProvider>
  );
}
