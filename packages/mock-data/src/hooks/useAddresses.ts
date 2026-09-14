"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useSaveSavedPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addressService.createSavedPlace,
    onSuccess: () => {
      // The list is the only view of saved places, so a plain invalidation is
      // enough — no optimistic entry, since the server may replace an existing
      // Home/Work row rather than append (which only it knows the id of).
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedPlaces });
    },
  });
}

export function useDeleteSavedPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addressService.deleteSavedPlace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedPlaces });
    },
  });
}
