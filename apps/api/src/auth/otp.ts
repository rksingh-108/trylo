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
  const challenge = await db.otpChallenge.findFirst({
    where: { phone, purpose, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;
  await db.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
  return true;
}
