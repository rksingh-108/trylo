import type { AppNotification } from "@trylo/types";
import { apiClient } from "../apiClient";

export async function getDriverNotifications(): Promise<AppNotification[]> {
  return apiClient.get<AppNotification[]>("/api/driver/notifications");
}

export async function markDriverNotificationRead(id: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`/api/driver/notifications/${id}/read`);
}

export async function markAllDriverNotificationsRead(): Promise<void> {
  await apiClient.post<void>("/api/driver/notifications/read-all");
}
