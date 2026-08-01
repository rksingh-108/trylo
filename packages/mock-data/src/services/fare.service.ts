import type { FareEstimate, GeoPoint, VehicleType } from "@trylo/types";
import { networkDelay } from "../latency";
import { computeFare, fareRates, haversineKm, promoCodes } from "../seed";

export interface FareEstimateRequest {
  pickup: GeoPoint;
  drop: GeoPoint;
  promoCode?: string;
}

export async function getFareEstimates(req: FareEstimateRequest): Promise<FareEstimate[]> {
  const distanceKm = Math.max(0.8, haversineKm(req.pickup, req.drop));
  const promo = req.promoCode
    ? promoCodes.find((p) => p.code.toLowerCase() === req.promoCode!.toLowerCase())
    : undefined;

  const estimates: FareEstimate[] = (Object.keys(fareRates) as VehicleType[]).map((vehicleType) => {
    const rate = fareRates[vehicleType];
    const { fare, etaMinutes } = computeFare(vehicleType, distanceKm, promo);
    return {
      vehicleType,
      fare,
      etaMinutes,
      capacity: rate.capacity,
      label: rate.label,
      description: rate.description,
    };
  });

  return networkDelay(estimates);
}

export async function validatePromoCode(code: string) {
  const promo = promoCodes.find((p) => p.code.toLowerCase() === code.toLowerCase());
  return networkDelay(promo ?? null, 200, 450);
}
