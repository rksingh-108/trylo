import type { AddressSuggestion, SavedPlace } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  return apiClient.get<AddressSuggestion[]>("/api/customer/addresses/search", { q: query });
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  return apiClient.get<SavedPlace[]>("/api/customer/saved-places");
}
