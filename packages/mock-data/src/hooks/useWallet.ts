"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as walletService from "../services/wallet.service";
import { queryKeys } from "./queryKeys";

export function useWallet() {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: walletService.getWallet,
  });
}

export function useTopUpWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: walletService.topUpWallet,
    onSuccess: (wallet) => {
      queryClient.setQueryData(queryKeys.wallet, wallet);
    },
  });
}
