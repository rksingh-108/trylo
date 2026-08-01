"use client";

import type { GeoPoint } from "@trylo/types";
import { useQuery } from "@tanstack/react-query";
import * as fareService from "../services/fare.service";
import { queryKeys } from "./queryKeys";

function pointKey(p: GeoPoint) {
  return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
}

export function useFareEstimates(pickup: GeoPoint | null, drop: GeoPoint | null, promoCode?: string) {
  return useQuery({
    queryKey: queryKeys.fareEstimates(pickup ? pointKey(pickup) : "none", drop ? pointKey(drop) : "none", promoCode),
    queryFn: () => fareService.getFareEstimates({ pickup: pickup!, drop: drop!, promoCode }),
    enabled: Boolean(pickup && drop),
  });
}
