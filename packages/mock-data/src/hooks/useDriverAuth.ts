"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as driverAuthService from "../services/driverAuth.service";
import { queryKeys } from "./queryKeys";

export function useCurrentDriver() {
  return useQuery({
    queryKey: queryKeys.currentDriver,
    queryFn: driverAuthService.getCurrentDriver,
  });
}

export function useRequestDriverOtp() {
  return useMutation({
    mutationFn: (phone: string) => driverAuthService.requestDriverOtp(phone),
  });
}

export function useVerifyDriverOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, otp }: { phone: string; otp: string }) =>
      driverAuthService.verifyDriverOtp(phone, otp),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.setQueryData(queryKeys.currentDriver, result.driver);
      }
    },
  });
}

export function useSubmitVehicleDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: driverAuthService.submitVehicleDetails,
    onSuccess: (driver) => {
      queryClient.setQueryData(queryKeys.currentDriver, driver);
    },
  });
}

export function useUpdateMarkerStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: driverAuthService.updateMarkerStyle,
    onSuccess: (driver) => {
      queryClient.setQueryData(queryKeys.currentDriver, driver);
      // dashboardSummary embeds its own copy of the driver, not derived from
      // currentDriver, so it needs its own invalidation to pick up the change.
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

export function useKycDocuments() {
  return useQuery({
    queryKey: queryKeys.kycDocuments,
    queryFn: driverAuthService.getKycDocuments,
    refetchInterval: (query) => {
      const docs = query.state.data;
      const hasPending = docs?.some((d) => d.status === "pending_review");
      return hasPending ? 1500 : false;
    },
    refetchIntervalInBackground: true,
  });
}

export function useUploadKycDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, fileName }: { docId: string; fileName: string }) =>
      driverAuthService.uploadKycDocument(docId, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kycDocuments });
    },
  });
}

export function useVerificationStatus() {
  return useQuery({
    queryKey: queryKeys.verificationStatus,
    queryFn: driverAuthService.getVerificationStatus,
    refetchInterval: (query) => (query.state.data === "verified" ? false : 2000),
    refetchIntervalInBackground: true,
  });
}

/** Revokes the session server-side and clears local tokens; caller still owns navigation/cache-clear. */
export function useLogoutDriver() {
  return useMutation({
    mutationFn: driverAuthService.logoutDriver,
  });
}
