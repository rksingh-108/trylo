"use client";

import { useQuery } from "@tanstack/react-query";
import * as paymentMethodService from "../services/paymentMethod.service";
import { queryKeys } from "./queryKeys";

export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: paymentMethodService.getPaymentMethods,
    staleTime: 60_000,
  });
}
