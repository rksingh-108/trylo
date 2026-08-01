import type { AddressSuggestion } from "@trylo/types";
import { CITY_CENTER, jitter } from "./geo";

const PLACE_NAMES: Array<{ primaryText: string; secondaryText: string }> = [
  { primaryText: "Indiranagar Metro Station", secondaryText: "100 Feet Rd, Indiranagar" },
  { primaryText: "Koramangala 5th Block", secondaryText: "80 Feet Rd, Koramangala" },
  { primaryText: "MG Road", secondaryText: "Mahatma Gandhi Rd, Bengaluru" },
  { primaryText: "Whitefield Main Road", secondaryText: "ITPL Rd, Whitefield" },
  { primaryText: "HSR Layout Sector 2", secondaryText: "27th Main Rd, HSR Layout" },
  { primaryText: "Cubbon Park", secondaryText: "Kasturba Rd, Bengaluru" },
  { primaryText: "Electronic City Phase 1", secondaryText: "Hosur Rd, Bengaluru" },
  { primaryText: "Jayanagar 4th Block", secondaryText: "Jayanagar, Bengaluru" },
  { primaryText: "Kempegowda International Airport", secondaryText: "Devanahalli, Bengaluru" },
  { primaryText: "Bellandur Lake", secondaryText: "Sarjapur Rd, Bellandur" },
];

export const addressSuggestions: AddressSuggestion[] = PLACE_NAMES.map((place, i) => ({
  id: `addr_${i}`,
  primaryText: place.primaryText,
  secondaryText: place.secondaryText,
  point: jitter(CITY_CENTER, 6),
}));

export function searchAddressSuggestions(query: string): AddressSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return addressSuggestions.slice(0, 5);
  return addressSuggestions.filter(
    (s) => s.primaryText.toLowerCase().includes(q) || s.secondaryText.toLowerCase().includes(q)
  );
}

export const defaultSavedPlaces = [
  {
    label: "home" as const,
    name: "Home",
    address: "12th Cross, Indiranagar, Bengaluru",
    point: jitter(CITY_CENTER, 3),
  },
  {
    label: "work" as const,
    name: "Work",
    address: "Prestige Tech Park, Kadubeesanahalli, Bengaluru",
    point: jitter(CITY_CENTER, 5),
  },
];

export const defaultPaymentMethods = [
  { type: "upi" as const, label: "UPI", detail: "you@okhdfcbank", isDefault: true },
  { type: "card" as const, label: "HDFC Bank Debit Card", detail: "•••• 4821", isDefault: false },
  { type: "cash" as const, label: "Cash", detail: "Pay the driver directly", isDefault: false },
];
