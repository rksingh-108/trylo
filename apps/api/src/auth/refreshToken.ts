import crypto from "crypto";
import { db } from "../db";
import type { Role } from "./jwt";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Issues a new refresh token and persists only its hash, never the raw value. */
export async function issueRefreshToken(ownerId: string, ownerRole: Role, userAgent?: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      ownerId,
      ownerRole,
      refreshTokenHash: hashToken(raw),
      userAgent,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return raw;
}

/**
 * Validates a refresh token and rotates it: the presented token is revoked and a
 * fresh one is issued in the same call, so a refresh token is single-use — if a
 * leaked/stolen token is replayed after the legitimate client already rotated it,
 * the replay will fail (its hash is revoked).
 */
export async function rotateRefreshToken(
  rawToken: string,
  userAgent?: string
): Promise<{ ownerId: string; ownerRole: Role; refreshToken: string } | null> {
  const hash = hashToken(rawToken);
  const session = await db.session.findUnique({ where: { refreshTokenHash: hash } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const ownerRole = session.ownerRole as Role;
  const newRaw = await issueRefreshToken(session.ownerId, ownerRole, userAgent);
  return { ownerId: session.ownerId, ownerRole, refreshToken: newRaw };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const hash = hashToken(rawToken);
  await db.session.updateMany({ where: { refreshTokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}
