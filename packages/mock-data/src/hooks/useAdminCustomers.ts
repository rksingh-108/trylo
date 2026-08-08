"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as adminCustomersService from "../services/adminCustomers.service";
import type { AdminCustomerListQuery } from "../services/adminCustomers.service";
import { queryKeys } from "./queryKeys";

export function useAdminCustomers(query: AdminCustomerListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminCustomers(JSON.stringify(query)),
    queryFn: () => adminCustomersService.listAdminCustomers(query),
  });
}

export function useAdminCustomer(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminCustomer(id ?? "none"),
    queryFn: () => adminCustomersService.getAdminCustomer(id!),
    enabled: Boolean(id),
  });
}

export function useAdminCustomerRides(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminCustomerRides(id ?? "none"),
    queryFn: () => adminCustomersService.getAdminCustomerRides(id!),
    enabled: Boolean(id),
  });
}

export function useAdminCustomerWallet(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminCustomerWallet(id ?? "none"),
    queryFn: () => adminCustomersService.getAdminCustomerWallet(id!),
    enabled: Boolean(id),
  });
}

export function useSuspendAdminCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminCustomersService.suspendAdminCustomer(id, reason),
    onSuccess: (customer) => {
      queryClient.setQueryData(queryKeys.adminCustomer(customer.id), customer);
      queryClient.invalidateQueries({ queryKey: ["adminCustomers"] });
    },
  });
}

export function useUnsuspendAdminCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCustomersService.unsuspendAdminCustomer(id),
    onSuccess: (customer) => {
      queryClient.setQueryData(queryKeys.adminCustomer(customer.id), customer);
      queryClient.invalidateQueries({ queryKey: ["adminCustomers"] });
    },
  });
}
