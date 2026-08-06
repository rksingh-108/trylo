"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as authService from "../services/auth.service";
import { queryKeys } from "./queryKeys";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authService.getCurrentUser,
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => authService.requestOtp(phone),
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, otp }: { phone: string; otp: string }) => authService.verifyOtp(phone, otp),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.setQueryData(queryKeys.currentUser, result.user);
      }
    },
  });
}

export function useCompleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authService.completeProfile,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.currentUser, user);
    },
  });
}

/** Revokes the session server-side and clears local tokens; caller still owns navigation/cache-clear. */
export function useLogout() {
  return useMutation({
    mutationFn: authService.logout,
  });
}
