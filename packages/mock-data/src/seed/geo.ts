import type { GeoPoint } from "@trylo/types";

/** Mock city center (Bengaluru-style coordinates) all seed data is scattered around. */
export const CITY_CENTER: GeoPoint = { lat: 12.9716, lng: 77.5946 };

export function jitter(point: GeoPoint, spreadKm = 2): GeoPoint {
  const kmToDeg = 1 / 111;
  return {
    lat: point.lat + (Math.random() - 0.5) * spreadKm * kmToDeg,
    lng: point.lng + (Math.random() - 0.5) * spreadKm * kmToDeg,
  };
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.asin(Math.sqrt(h));
}
