"use client";

import { useQuery } from "@tanstack/react-query";
import * as addressService from "../services/address.service";
import { queryKeys } from "./queryKeys";

export function useAddressSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.addresses(query),
    queryFn: () => addressService.searchAddresses(query),
    enabled: true,
    staleTime: 10_000,
  });
}

export function useSavedPlaces() {
  return useQuery({
    queryKey: queryKeys.savedPlaces,
    queryFn: addressService.getSavedPlaces,
    staleTime: 60_000,
  });
}
