import type { AddressSuggestion, SavedPlace, SavedPlaceLabel } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  return apiClient.get<AddressSuggestion[]>("/api/customer/addresses/search", { q: query });
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  return apiClient.get<SavedPlace[]>("/api/customer/saved-places");
}

export interface SavedPlaceInput {
  label: SavedPlaceLabel;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** Saves an address the rider actually chose; `home`/`work` replace the existing slot. */
export async function createSavedPlace(input: SavedPlaceInput): Promise<SavedPlace> {
  return apiClient.post<SavedPlace>("/api/customer/saved-places", input);
}

export async function deleteSavedPlace(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/customer/saved-places/${id}`);
}
