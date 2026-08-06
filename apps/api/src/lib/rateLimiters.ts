import rateLimit from "express-rate-limit";

/** General abuse backstop across the whole API. Generous — this is not the primary defense. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
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
