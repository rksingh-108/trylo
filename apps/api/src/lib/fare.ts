import type { FareBreakdown, PromoCode, VehicleType } from "@trylo/types";

interface FareRate {
  base: number;
  perKm: number;
  perMin: number;
  label: string;
  description: string;
  capacity: number;
  avgSpeedKmph: number;
}

export const fareRates: Record<VehicleType, FareRate> = {
  bike: {
    base: 15,
    perKm: 5,
    perMin: 0.8,
    label: "Bike",
    description: "Quick, affordable, beats traffic",
    capacity: 1,
    avgSpeedKmph: 28,
  },
  auto: {
    base: 25,
    perKm: 8,
    perMin: 1,
    label: "Auto",
    description: "Comfortable three-wheeler rides",
    capacity: 3,
    avgSpeedKmph: 22,
  },
  cab: {
    base: 50,
    perKm: 13,
    perMin: 1.5,
    label: "Cab",
    description: "AC cabs for a comfortable ride",
    capacity: 4,
    avgSpeedKmph: 24,
  },
};

export const promoCodes: PromoCode[] = [
  { code: "TRYLO50", description: "50% off, up to ₹50", discountPercent: 50, maxDiscount: 50 },
  { code: "FIRSTRIDE", description: "20% off on your first ride", discountPercent: 20, maxDiscount: 100 },
];

export function computeFare(
  vehicleType: VehicleType,
  distanceKm: number,
  promo?: PromoCode
): { fare: FareBreakdown; etaMinutes: number } {
  const rate = fareRates[vehicleType];
  const durationMin = Math.max(3, Math.round((distanceKm / rate.avgSpeedKmph) * 60));
  const base = rate.base;
  const distance = Math.round(distanceKm * rate.perKm);
  const time = Math.round(durationMin * rate.perMin);
  const surgeActive = Math.random() < 0.15;
  const surge = surgeActive ? Math.round((base + distance + time) * 0.15) : 0;
  const subtotal = base + distance + time + surge;
  const promoDiscount = promo
    ? Math.min(Math.round(subtotal * (promo.discountPercent / 100)), promo.maxDiscount)
    : 0;
  const total = Math.max(0, subtotal - promoDiscount);

  return {
    fare: { base, distance, time, surge, promoDiscount, total, currency: "INR" },
    etaMinutes: durationMin,
  };
}
