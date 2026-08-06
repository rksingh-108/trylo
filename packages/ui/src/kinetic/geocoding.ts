import type { MapGeoPoint } from "./premium-map";

/** Converts a lat/lng into a real street address via the Google Geocoding API. */
export async function reverseGeocode(point: MapGeoPoint): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${point.lat},${point.lng}&key=${apiKey}`
    );
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]?.formatted_address) {
      return data.results[0].formatted_address as string;
    }
    return null;
  } catch {
    return null;
  }
}

/** Converts a free-text address into a lat/lng via the Google Geocoding API. */
export async function geocodeAddress(address: string): Promise<(MapGeoPoint & { formattedAddress: string }) | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    const data = await res.json();
    const result = data.results?.[0];
    if (data.status === "OK" && result?.geometry?.location) {
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }
    return null;
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
