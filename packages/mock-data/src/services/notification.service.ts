import type { AppNotification } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getNotifications(): Promise<AppNotification[]> {
  return apiClient.get<AppNotification[]>("/api/customer/notifications");
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`/api/customer/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post<void>("/api/customer/notifications/read-all");
}
