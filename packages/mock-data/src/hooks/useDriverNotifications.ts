"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as driverNotificationService from "../services/driverNotification.service";
import { queryKeys } from "./queryKeys";

export function useDriverNotifications() {
  return useQuery({
    queryKey: queryKeys.driverNotifications,
    queryFn: driverNotificationService.getDriverNotifications,
  });
}

export function useMarkDriverNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverNotificationService.markDriverNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.driverNotifications }),
  });
}
