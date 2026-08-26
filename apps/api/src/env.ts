import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  // Required (like DATABASE_URL/JWT_SECRET below) rather than defaulted to
  // localhost - a silent localhost default here would let the server start up
  // looking healthy while every real frontend origin gets silently rejected
  // by the browser's own CORS enforcement, with nothing to catch the
  // misconfiguration at startup. Every real environment (local dev via
  // apps/api/.env, CI via ci.yml, production via the Container App's env
  // vars) already sets this explicitly.
  CORS_ORIGINS: z.string().min(1),
  // Set together (by the private-LAN-test start script only) to serve the
  // API over HTTPS with a local self-signed cert instead of plain HTTP.
  // Unset in normal dev - the server falls back to http.createServer exactly
  // as before.
  HTTPS_CERT_PATH: z.string().optional(),
  HTTPS_KEY_PATH: z.string().optional(),
  // Set only by the CI workflow (.github/workflows/ci.yml) to bypass the
  // global per-IP rate limiter (see lib/rateLimiters.ts). CI runs both e2e
  // suites back-to-back against one long-lived server process from a single
  // source IP, which can exceed that per-IP budget on request volume alone -
  // nothing to do with either suite actually misbehaving. Unset everywhere
  // else (production, local dev) - the server behaves exactly as before.
  DISABLE_RATE_LIMIT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((o) => o.trim()),
  disableRateLimit: parsed.data.DISABLE_RATE_LIMIT === "true",
};
