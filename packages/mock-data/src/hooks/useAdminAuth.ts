"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as adminAuthService from "../services/adminAuth.service";
import { queryKeys } from "./queryKeys";

export function useCurrentAdmin() {
  return useQuery({
    queryKey: queryKeys.currentAdmin,
    queryFn: adminAuthService.getCurrentAdmin,
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      adminAuthService.loginAdmin(email, password),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.currentAdmin, result.admin);
    },
  });
}

/** Revokes the session server-side and clears local tokens; caller still owns navigation/cache-clear. */
export function useAdminLogout() {
  return useMutation({
    mutationFn: adminAuthService.logoutAdmin,
  });
}
