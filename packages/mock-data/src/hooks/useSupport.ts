"use client";

import type { SupportTicket } from "@trylo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as supportService from "../services/support.service";
import { queryKeys } from "./queryKeys";

export function useSupportTickets(role: "customer" | "driver") {
  return useQuery({
    queryKey: queryKeys.supportTickets(role),
    queryFn: () => supportService.getMySupportTickets(role),
  });
}

export function useCreateSupportTicket(role: "customer" | "driver") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: supportService.CreateSupportTicketInput) => supportService.createSupportTicket(role, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supportTickets(role) });
    },
  });
}

export type { SupportTicket };