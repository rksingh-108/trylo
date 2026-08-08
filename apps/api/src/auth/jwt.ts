import jwt from "jsonwebtoken";
import { env } from "../env";

export type Role = "customer" | "driver" | "admin";

export interface TokenPayload {
  sub: string;
  role: Role;
}

// Short-lived on purpose: the client refreshes it via /api/auth/refresh using a
// longer-lived refresh token (see auth/refreshToken.ts), so a leaked access
// token has a small blast-radius window instead of staying valid for 30 days.
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
