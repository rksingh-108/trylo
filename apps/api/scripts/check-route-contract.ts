/**
 * Static contract check: every backend path the frontend services call must be
 * backed by a route the API actually mounts. Catches 404-class bugs (typos,
 * renamed endpoints, handlers that were never wired) without needing a server.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// apps/api/scripts -> apps/api -> apps -> repo root, independent of the caller's cwd.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ROUTES_DIR = join(ROOT, "apps/api/src/routes");
const SERVICES_DIR = join(ROOT, "packages/mock-data/src/services");

// Express mount prefix for each router file (mirrors apps/api/src/app.ts).
const MOUNTS: Record<string, string> = {
  "customerAuth.routes.ts": "/api/customer/auth",
  "customerMisc.routes.ts": "/api/customer",
  "customerRide.routes.ts": "/api/customer/rides",
  "customerWallet.routes.ts": "/api/customer/wallet",
  "customerNotifications.routes.ts": "/api/customer/notifications",
  "driverAuth.routes.ts": "/api/driver/auth",
  "driverRide.routes.ts": "/api/driver",
  "driverEarnings.routes.ts": "/api/driver/earnings",
  "driverNotifications.routes.ts": "/api/driver/notifications",
  "adminAuth.routes.ts": "/api/admin/auth",
  "adminDashboard.routes.ts": "/api/admin/dashboard",
  "adminCustomers.routes.ts": "/api/admin/customers",
  "adminDrivers.routes.ts": "/api/admin/drivers",
  "adminRides.routes.ts": "/api/admin/rides",
  "adminPayments.routes.ts": "/api/admin/payments",
  "adminAnalytics.routes.ts": "/api/admin/analytics",
  "adminNotifications.routes.ts": "/api/admin/notifications",
  "adminPromos.routes.ts": "/api/admin/promos",
  "adminPayouts.routes.ts": "/api/admin/payouts",
  "adminSupport.routes.ts": "/api/admin/support",
};

// Routers created by a factory get their prefix passed in at mount time.
const FACTORY_MOUNTS: Record<string, string[]> = {
  "support.routes.ts": ["/api/customer/support", "/api/driver/support"],
};

/**
 * Split a path into segments, dropping the leading slash and any query/trailing
 * slash. Service-side template holes (`${id}`) are rewritten to `:` so they
 * compare equal to an Express `:param` under the wildcard rule below.
 */
function segments(path: string): string[] {
  return path
    .split("?")[0]
    .replace(/\$\{[^}]*\}/g, ":")
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ":")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);
}

/**
 * Segment-wise match: a `:whatever` on *either* side is a wildcard, because a
 * route param (`:rideId`) and a service-side template hole (`${rideId}`) are
 * the same thing seen from two directions.
 */
function matches(route: string[], call: string[]): boolean {
  if (route.length !== call.length) return false;
  return route.every((seg, i) => {
    const other = call[i];
    return seg.startsWith(":") || other.startsWith(":") || seg === other;
  });
}

const routes: string[][] = [];
for (const file of readdirSync(ROUTES_DIR)) {
  if (!file.endsWith(".ts")) continue;
  const prefixes = MOUNTS[file] ? [MOUNTS[file]] : FACTORY_MOUNTS[file];
  if (!prefixes) continue;
  const src = readFileSync(join(ROUTES_DIR, file), "utf8");
  for (const prefix of prefixes) {
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
      routes.push(segments(prefix + m[2]));
    }
  }
}

const calls = new Set<string>();
for (const file of readdirSync(SERVICES_DIR)) {
  if (!file.endsWith(".ts")) continue;
  const src = readFileSync(join(SERVICES_DIR, file), "utf8");
  for (const m of src.matchAll(/apiClient\.(get|post|put|patch|delete)<[^>]*>\(\s*[`"']([^`"']+)/g)) {
    calls.add(`${m[2]}\u0000${file}`);
  }
}

const missing = [...calls]
  .map((c) => {
    const [path, file] = c.split("\u0000");
    return { path, file, segs: segments(path) };
  })
  .filter(({ segs }) => !routes.some((r) => matches(r, segs)));

if (missing.length === 0) {
  console.log(`OK — all ${calls.size} frontend API calls resolve to a mounted route.`);
} else {
  console.log(`MISSING ROUTES (${missing.length}):`);
  for (const { path, file } of missing.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`  ${path}   <- ${file}`);
  }
  process.exitCode = 1;
}
