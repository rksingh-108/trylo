import type { PrismaClient } from "@prisma/client";
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

/**
 * The initial promo codes, seeded into the PromoCode table on first boot (see
 * seedPromoCodes below). After that, the database is the source of truth:
 * admins create/edit/deactivate codes via the admin API and every lookup reads
 * from the DB, so the platform isn't stuck with a hardcoded list forever.
 */
export const defaultPromoCodes: PromoCode[] = [
  { code: "TRYLO50", description: "50% off, up to ₹50", discountPercent: 50, maxDiscount: 50 },
  { code: "FIRSTRIDE", description: "20% off on your first ride", discountPercent: 20, maxDiscount: 100 },
];

/**
 * Seeds the default promo codes on first boot if the table is empty. Called
 * from index.ts at startup — never on the hot path. If the table already has
 * rows (an admin created or edited codes), the defaults are left alone.
 */
export async function seedPromoCodes(db: PrismaClient): Promise<void> {
  try {
    const existing = await db.promoCode.count();
    if (existing > 0) return;
    await db.promoCode.createMany({
      data: defaultPromoCodes.map((p) => ({
        code: p.code,
        discountPercent: p.discountPercent,
        maxDiscount: p.maxDiscount,
        active: true,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[fare] failed to seed default promo codes", err);
  }
}

/**
 * Loads the active promo codes from the database. The hardcoded defaults are a
 * last-resort fallback only (e.g. the table was never seeded because of a
 * transient DB hiccup at boot), so existing behavior is never silently worse.
 */
export async function loadActivePromoCodes(db: PrismaClient): Promise<PromoCode[]> {
  try {
    const rows = await db.promoCode.findMany({ where: { active: true } });
    if (rows.length === 0) return defaultPromoCodes;
    return rows.map((p) => ({
      code: p.code,
      description: `${p.discountPercent}% off${p.maxDiscount ? `, up to ₹${p.maxDiscount}` : ""}`,
      discountPercent: p.discountPercent,
      maxDiscount: p.maxDiscount ?? 0,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[fare] failed to load promo codes, falling back to defaults", err);
    return defaultPromoCodes;
  }
}

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
