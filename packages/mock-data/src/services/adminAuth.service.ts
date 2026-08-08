import type { Admin } from "@trylo/types";
import { apiClient } from "../apiClient";
import { clearToken, getRefreshToken, getToken, setTokens } from "../tokenStore";

export interface AdminLoginResult {
  admin: Admin;
  token: string;
  refreshToken: string;
}

export async function loginAdmin(email: string, password: string): Promise<AdminLoginResult> {
  const result = await apiClient.post<AdminLoginResult>("/api/admin/auth/login", { email, password });
  setTokens(result.token, result.refreshToken);
  return result;
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  if (!getToken()) return null;
  try {
    return await apiClient.get<Admin | null>("/api/admin/auth/me");
  } catch {
    return null;
  }
}

/** Revokes the refresh-token session server-side, then clears local tokens. Best-effort. */
export async function logoutAdmin(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await apiClient.post("/api/auth/logout", { refreshToken }).catch(() => {});
  }
  clearToken();
}
