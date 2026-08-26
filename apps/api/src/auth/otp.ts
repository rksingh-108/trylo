import type { OtpPurpose } from "@prisma/client";
import { db } from "../db";

const OTP_TTL_MS = 5 * 60 * 1000;

export async function createOtpChallenge(phone: string, purpose: OtpPurpose): Promise<string> {
  const code = String(Math.floor(1000 + Math.random() * 8999));
  await db.otpChallenge.create({
    data: { phone, purpose, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  return code;
}

export async function verifyOtpChallenge(
  phone: string,
  purpose: OtpPurpose,
  code: string
): Promise<boolean> {
  // A single atomic updateMany (rather than findFirst-then-update) so two
  // concurrent verify requests presenting the same still-valid code can never
  // both pass the check before either write lands.
  const { count } = await db.otpChallenge.updateMany({
    where: { phone, purpose, code, consumed: false, expiresAt: { gt: new Date() } },
    data: { consumed: true },
  });
  return count > 0;
}
