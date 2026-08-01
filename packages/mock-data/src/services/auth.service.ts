import type { User } from "@trylo/types";
import { networkDelay, randomId } from "../latency";
import { customerDb } from "../store";

const DEMO_OTP = "1234";

export interface OtpRequestResult {
  requestId: string;
  /** Surfaced for the mock UI so testers don't need a real SMS — a real API would never return this. */
  devHintOtp: string;
}

export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  return networkDelay({ requestId: randomId("otpreq"), devHintOtp: DEMO_OTP });
}

export interface VerifyOtpResult {
  success: boolean;
  isNewUser: boolean;
  user: User | null;
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResult> {
  const success = otp === DEMO_OTP;
  if (!success) {
    return networkDelay({ success: false, isNewUser: false, user: null });
  }
  const isNewUser = !customerDb.user;
  if (isNewUser) {
    customerDb.user = {
      id: randomId("user"),
      phone,
      name: "",
      rating: 5,
      createdAt: new Date().toISOString(),
    };
  }
  return networkDelay({ success: true, isNewUser, user: customerDb.user });
}

export async function completeProfile(input: { name: string; email?: string }): Promise<User> {
  if (!customerDb.user) {
    throw new Error("No authenticated user");
  }
  customerDb.user = { ...customerDb.user, name: input.name, email: input.email };
  return networkDelay(customerDb.user);
}

export async function getCurrentUser(): Promise<User | null> {
  return networkDelay(customerDb.user);
}
