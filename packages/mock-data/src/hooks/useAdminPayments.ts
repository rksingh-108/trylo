"use client";

import { useQuery } from "@tanstack/react-query";
import * as adminPaymentsService from "../services/adminPayments.service";
import type { AdminDriverEarningQuery, AdminWalletTransactionQuery } from "../services/adminPayments.service";
import { queryKeys } from "./queryKeys";

export function useAdminWalletTransactions(query: AdminWalletTransactionQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminWalletTransactions(JSON.stringify(query)),
    queryFn: () => adminPaymentsService.listAdminWalletTransactions(query),
  });
}

export function useAdminDriverEarningsList(query: AdminDriverEarningQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminDriverEarningsList(JSON.stringify(query)),
    queryFn: () => adminPaymentsService.listAdminDriverEarnings(query),
  });
}
