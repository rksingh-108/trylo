import type { MapGeoPoint } from "./premium-map";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/** Converts a lat/lng into a real street address via OpenStreetMap's Nominatim (free, no key). */
export async function reverseGeocode(point: MapGeoPoint): Promise<string | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/reverse?lat=${point.lat}&lon=${point.lng}&format=json&zoom=18`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    return (data?.display_name as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Converts a free-text address into a lat/lng via Nominatim. */
export async function geocodeAddress(address: string): Promise<(MapGeoPoint & { formattedAddress: string }) | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    const result = data?.[0];
    if (!result) return null;
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      formattedAddress: result.display_name as string,
    };
  } catch {
    return null;
  }
}

/**
 * Reads the browser's real GPS location, reverse-geocoded to a street address.
 * Resolves to null if permission is denied, geolocation is unavailable, or the
 * request fails — callers should fall back to a sensible default in that case.
 */
export function getCurrentLocationWithAddress(): Promise<{ address: string; point: MapGeoPoint } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const address = await reverseGeocode(point);
        resolve({ address: address ?? "Current Location", point });
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 60_000 }
    );
  });
}
