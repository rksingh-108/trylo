"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as adminDriversService from "../services/adminDrivers.service";
import type { AdminDriverListQuery } from "../services/adminDrivers.service";
import { queryKeys } from "./queryKeys";

export function useAdminDrivers(query: AdminDriverListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminDrivers(JSON.stringify(query)),
    queryFn: () => adminDriversService.listAdminDrivers(query),
  });
}

export function useAdminDriver(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminDriver(id ?? "none"),
    queryFn: () => adminDriversService.getAdminDriver(id!),
    enabled: Boolean(id),
  });
}

export function useAdminDriverKyc(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminDriverKyc(id ?? "none"),
    queryFn: () => adminDriversService.getAdminDriverKyc(id!),
    enabled: Boolean(id),
  });
}

export function useAdminDriverRides(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminDriverRides(id ?? "none"),
    queryFn: () => adminDriversService.getAdminDriverRides(id!),
    enabled: Boolean(id),
  });
}

export function useAdminDriverEarnings(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminDriverEarnings(id ?? "none"),
    queryFn: () => adminDriversService.getAdminDriverEarnings(id!),
    enabled: Boolean(id),
  });
}

export function useApproveAdminDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDriversService.approveAdminDriver(id),
    onSuccess: (driver) => {
      queryClient.setQueryData(queryKeys.adminDriver(driver.id), driver);
      queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
    },
  });
}

export function useRejectAdminDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => adminDriversService.rejectAdminDriver(id, reason),
    onSuccess: (driver) => {
      queryClient.setQueryData(queryKeys.adminDriver(driver.id), driver);
      queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
    },
  });
}

export function useSuspendAdminDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => adminDriversService.suspendAdminDriver(id, reason),
    onSuccess: (driver) => {
      queryClient.setQueryData(queryKeys.adminDriver(driver.id), driver);
      queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
    },
  });
}

export function useUnsuspendAdminDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDriversService.unsuspendAdminDriver(id),
    onSuccess: (driver) => {
      queryClient.setQueryData(queryKeys.adminDriver(driver.id), driver);
      queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
    },
  });
}
