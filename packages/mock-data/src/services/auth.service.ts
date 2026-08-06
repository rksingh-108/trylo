import type { User } from "@trylo/types";
import { apiClient } from "../apiClient";
import { clearToken, getRefreshToken, getToken, setTokens } from "../tokenStore";

export interface OtpRequestResult {
  requestId: string;
  /** Surfaced for the mock UI so testers don't need a real SMS — a real API would never return this. */
  devHintOtp: string;
}

export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  return apiClient.post<OtpRequestResult>("/api/customer/auth/otp/request", { phone });
}

export interface VerifyOtpResult {
  success: boolean;
  isNewUser: boolean;
  user: User | null;
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResult> {
  const result = await apiClient.post<VerifyOtpResult & { token?: string; refreshToken?: string }>(
    "/api/customer/auth/otp/verify",
    { phone, otp }
  );
  if (result.success && result.token && result.refreshToken) {
    setTokens(result.token, result.refreshToken);
  }
  return result;
}

export async function completeProfile(input: { name: string; email?: string }): Promise<User> {
  return apiClient.post<User>("/api/customer/auth/profile", input);
}

/** Revokes the refresh-token session server-side, then clears local tokens. Best-effort. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await apiClient.post("/api/auth/logout", { refreshToken }).catch(() => {});
  }
  clearToken();
}

export async function getCurrentUser(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    return await apiClient.get<User | null>("/api/customer/auth/me");
  } catch {
    return null;
  }
}
