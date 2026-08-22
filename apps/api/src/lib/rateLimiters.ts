import rateLimit from "express-rate-limit";
import { env } from "../env";

/**
 * General abuse backstop across the whole API. Generous — this is not the primary defense.
 *
 * `skip` bypasses this in CI only (DISABLE_RATE_LIMIT=true, set exclusively
 * by .github/workflows/ci.yml — see env.ts). CI runs two e2e suites
 * back-to-back against one long-lived server process from a single source
 * IP, which can exceed this per-IP budget on request volume alone. Unset
 * (and therefore always false) in production and local dev, so this limiter
 * behaves exactly as before everywhere else.
 */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.disableRateLimit,
});

/**
 * OTP request/verify are the most sensitive endpoints (no password — brute-forcing
 * a 4-digit OTP is trivial without a strict limit here). Keyed by IP + phone so one
 * bad actor can't lock out a real user's phone number by spamming from many IPs
 * while still being tight per-IP.
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${typeof req.body?.phone === "string" ? req.body.phone : ""}`,
  message: { error: "Too many attempts. Please try again later." },
});

/** Admin login is password-based (no OTP), so it gets its own brute-force backstop. */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${typeof req.body?.email === "string" ? req.body.email : ""}`,
  message: { error: "Too many attempts. Please try again later." },
});
