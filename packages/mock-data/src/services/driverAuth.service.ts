import type { Driver, KycDocument, VehicleType } from "@trylo/types";
import { apiClient } from "../apiClient";
import { getToken, setToken } from "../tokenStore";

export interface DriverOtpRequestResult {
  requestId: string;
  devHintOtp: string;
}

export async function requestDriverOtp(phone: string): Promise<DriverOtpRequestResult> {
  return apiClient.post<DriverOtpRequestResult>("/api/driver/auth/otp/request", { phone });
}

export interface VerifyDriverOtpResult {
  success: boolean;
  isNewDriver: boolean;
  driver: Driver | null;
}

export async function verifyDriverOtp(phone: string, otp: string): Promise<VerifyDriverOtpResult> {
  const result = await apiClient.post<VerifyDriverOtpResult & { token?: string }>(
    "/api/driver/auth/otp/verify",
    { phone, otp }
  );
  if (result.success && result.token) {
    setToken(result.token);
  }
  return result;
}

export interface VehicleDetailsInput {
  name: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  registrationNumber: string;
  color: string;
}

export async function submitVehicleDetails(input: VehicleDetailsInput): Promise<Driver> {
  return apiClient.post<Driver>("/api/driver/auth/vehicle", input);
}

export async function getKycDocuments(): Promise<KycDocument[]> {
  return apiClient.get<KycDocument[]>("/api/driver/auth/kyc");
}

export async function uploadKycDocument(docId: string, fileName: string): Promise<KycDocument> {
  return apiClient.post<KycDocument>(`/api/driver/auth/kyc/${docId}/upload`, { fileName });
}

export async function getVerificationStatus(): Promise<"pending" | "verified" | "rejected"> {
  return apiClient.get<"pending" | "verified" | "rejected">("/api/driver/auth/verification-status");
}

export async function getCurrentDriver(): Promise<Driver | null> {
  if (!getToken()) return null;
  try {
    return await apiClient.get<Driver | null>("/api/driver/auth/me");
  } catch {
    return null;
  }
}
