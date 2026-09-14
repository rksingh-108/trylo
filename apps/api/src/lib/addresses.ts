import type { AddressSuggestion } from "@trylo/types";

/**
 * Place search used to be served from a hardcoded list of ten Bengaluru place
 * names whose coordinates were `jitter(CITY_CENTER, 6)` — random points near
 * the city centre. Picking "Kempegowda International Airport" returned a point
 * ~30km from the airport, and every one of those fabricated coordinates was
 * sent to the backend as the rider's real pickup/destination.
 *
 * Now it proxies Photon (photon.komoot.io) — the same free, key-less,
 * OpenStreetMap-backed geocoder the customer app already uses for its search
 * box — so results are real places anywhere in the world with their true
 * coordinates.
 */
const PHOTON_BASE = "https://photon.komoot.io/api";
const SEARCH_LIMIT = 6;
/**
 * Photon is a public, best-effort service. Cap the wait so an unreachable or
 * slow geocoder can't hold a rider's search request open indefinitely — the
 * client surfaces an empty result instead, which reads as "no matches".
 */
const GEOCODE_TIMEOUT_MS = 5_000;

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

function joinUnique(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(", ");
}

export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  // Nothing to geocode — an empty query must not fall back to a canned list.
  if (q.length < 3) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const res = await fetch(`${PHOTON_BASE}/?q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`, {
      signal: controller.signal,
      headers: {
        // Nominatim/Photon etiquette: identify the caller.
        "User-Agent": "TRYLO/1.0 (ride-hailing; +https://trylo.app)",
      },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { features?: PhotonFeature[] };
    const features = data.features ?? [];

    return features
      .map((feature, index): AddressSuggestion | null => {
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        const [lng, lat] = coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const props = feature.properties ?? {};
        const street = joinUnique([props.housenumber, props.street]);
        const primaryText = props.name ?? street ?? props.city ?? "";
        if (!primaryText) return null;

        // Drop the primary text from the secondary line so "MG Road, MG Road,
        // Bengaluru" doesn't happen for street-level matches.
        const secondaryText = joinUnique([
          props.name ? street : undefined,
          props.district,
          props.city,
          props.state,
          props.country,
        ]);

        return {
          id: `osm_${props.osm_type ?? "place"}_${props.osm_id ?? index}_${index}`,
          primaryText,
          secondaryText: secondaryText || (props.city ?? ""),
          point: { lat, lng },
        };
      })
      .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null);
  } catch {
    // Network failure, abort, or malformed payload — report "no matches"
    // rather than inventing one.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cash is the one payment mode that exists without the rider registering
 * anything, so it's the only one seeded for a new account.
 *
 * This list used to also invent a UPI handle (`you@okhdfcbank`) and a card
 * (`HDFC Bank Debit Card •••• 4821`) for every new rider - instruments they had
 * never added, presented in their profile as if they were real. Nothing reads
 * these rows to take money (the whole list is display-only in the profile), so
 * the only thing they ever did was mislead the rider about what was on file.
 */
export const defaultPaymentMethods = [
  { type: "cash" as const, label: "Cash", detail: "Pay the driver directly", isDefault: true },
];
