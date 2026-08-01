import type { AddressSuggestion, SavedPlace } from "@trylo/types";
import { networkDelay } from "../latency";
import { savedPlaces, searchAddressSuggestions } from "../seed";

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  return networkDelay(searchAddressSuggestions(query), 200, 500);
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  return networkDelay(savedPlaces);
}
