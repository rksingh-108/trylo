import type { User } from "@trylo/types";
import { apiClient } from "../apiClient";
import { getToken, setToken } from "../tokenStore";

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
  const result = await apiClient.post<VerifyOtpResult & { token?: string }>(
    "/api/customer/auth/otp/verify",
    { phone, otp }
  );
  if (result.success && result.token) {
    setToken(result.token);
  }
  return result;
}

export async function completeProfile(input: { name: string; email?: string }): Promise<User> {
  return apiClient.post<User>("/api/customer/auth/profile", input);
}

export async function getCurrentUser(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    return await apiClient.get<User | null>("/api/customer/auth/me");
  } catch {
    return null;
  }
}
