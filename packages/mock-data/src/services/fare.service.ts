import type { FareEstimate, GeoPoint, PromoCode } from "@trylo/types";
import { apiClient } from "../apiClient";

export interface FareEstimateRequest {
  pickup: GeoPoint;
  drop: GeoPoint;
  promoCode?: string;
}

export async function getFareEstimates(req: FareEstimateRequest): Promise<FareEstimate[]> {
  return apiClient.get<FareEstimate[]>("/api/customer/fares/estimates", {
    pickupLat: req.pickup.lat,
    pickupLng: req.pickup.lng,
    dropLat: req.drop.lat,
    dropLng: req.drop.lng,
    promoCode: req.promoCode,
  });
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  return apiClient.get<PromoCode | null>("/api/customer/fares/promo/validate", { code });
}
