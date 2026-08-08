"use client";

import { useQuery } from "@tanstack/react-query";
import * as adminDashboardService from "../services/adminDashboard.service";
import { queryKeys } from "./queryKeys";

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: adminDashboardService.getAdminDashboardStats,
  });
}
