"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as adminSupportService from "../services/adminSupport.service";
import { queryKeys } from "./queryKeys";

export function useAdminSupportTickets() {
  return useQuery({
    queryKey: queryKeys.adminSupportTickets,
    queryFn: adminSupportService.listAdminSupportTickets,
  });
}

export function useResolveSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminSupportService.resolveSupportTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSupportTickets });
    },
  });
}