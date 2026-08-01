import type { GeoPoint } from "./driver";

export interface AddressSuggestion {
  id: string;
  primaryText: string;
  secondaryText: string;
  point: GeoPoint;
}

export type SavedPlaceLabel = "home" | "work" | "other";

export interface SavedPlace {
  id: string;
  label: SavedPlaceLabel;
  name: string;
  address: string;
  point: GeoPoint;
}
