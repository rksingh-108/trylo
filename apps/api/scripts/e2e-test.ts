/**
 * End-to-end smoke test for the TRYLO backend: drives the full customer + driver
 * lifecycle against a running `pnpm --filter api dev` server using plain fetch and a
 * real socket.io-client connection (so the realtime path is genuinely exercised, not
 * just REST polling). Run with `pnpm --filter api e2e`.
 */
import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:4000";
let failures = 0;

function log(step: string, ok: boolean, detail?: string) {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${step}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

function assert(condition: boolean, step: string, detail?: string) {
  log(step, condition, detail);
  if (!condition) throw new Error(`FAILED: ${step}${detail ? " - " + detail : ""}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ApiResult<T> {
  status: number;
  data: T;
}

async function api<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    token?: string;
    query?: Record<string, string | number | undefined>;
  } = {}
): Promise<ApiResult<T>> {
  let url = `${API}${path}`;
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: T;
  try {
    data = text ? JSON.parse(text) : (undefined as T);
  } catch {
    data = text as unknown as T;
  }
  return { status: res.status, data };
}

async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  label: string,
  timeoutMs = 20000,
  intervalMs = 500
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

async function main() {
  const suffix = Date.now().toString().slice(-8);
  const customerPhone = `9${suffix}1`;
  const driverPhone = `9${suffix}2`;

  // ---- Customer signup ----
  console.log("\n=== Customer signup ===");
  const custOtpReq = await api<{ requestId: string; devHintOtp: string }>(
    "/api/customer/auth/otp/request",
    { method: "POST", body: { phone: customerPhone } }
  );
  assert(custOtpReq.status === 200 && !!custOtpReq.data.devHintOtp, "customer OTP requested");

  const custVerify = await api<{ success: boolean; isNewUser: boolean; token: string }>(
    "/api/customer/auth/otp/verify",
    { method: "POST", body: { phone: customerPhone, otp: custOtpReq.data.devHintOtp } }
  );
  assert(
    custVerify.data.success && custVerify.data.isNewUser && !!custVerify.data.token,
    "customer OTP verified as a new user, JWT issued"
  );
  const customerToken = custVerify.data.token;

  const custProfile = await api<{ id: string }>("/api/customer/auth/profile", {
    method: "POST",
    token: customerToken,
    body: { name: "E2E Rider", email: "rider@example.com" },
  });
  assert(custProfile.status === 200 && !!custProfile.data.id, "customer profile completed");

  const savedPlaces = await api<unknown[]>("/api/customer/saved-places", { token: customerToken });
  assert(savedPlaces.data.length === 2, "default saved places (Home/Work) seeded");

  const paymentMethods = await api<unknown[]>("/api/customer/payment-methods", { token: customerToken });
  assert(paymentMethods.data.length === 3, "default payment methods (UPI/Card/Cash) seeded");

  // Top up the wallet so the ride-completion debit is verifiable later.
  const topUp = await api<{ balance: number }>("/api/customer/wallet/topup", {
    method: "POST",
    token: customerToken,
    body: { amount: 500 },
  });
  assert(topUp.data.balance === 500, "wallet topped up to 500");

  // ---- Driver signup + onboarding ----
  console.log("\n=== Driver signup + onboarding ===");
  const drvOtpReq = await api<{ devHintOtp: string }>("/api/driver/auth/otp/request", {
    method: "POST",
    body: { phone: driverPhone },
  });
  assert(!!drvOtpReq.data.devHintOtp, "driver OTP requested");

  const drvVerify = await api<{ success: boolean; isNewDriver: boolean; token: string }>(
    "/api/driver/auth/otp/verify",
    { method: "POST", body: { phone: driverPhone, otp: drvOtpReq.data.devHintOtp } }
  );
  assert(
    drvVerify.data.success && drvVerify.data.isNewDriver && !!drvVerify.data.token,
    "driver OTP verified as a new driver, JWT issued"
  );
  const driverToken = drvVerify.data.token;

  const kycList = await api<Array<{ id: string; type: string }>>("/api/driver/auth/kyc", {
    token: driverToken,
  });
  assert(kycList.data.length === 4, "4 KYC documents seeded (license/rc/insurance/photo)");

  for (const doc of kycList.data) {
    const upload = await api(`/api/driver/auth/kyc/${doc.id}/upload`, {
      method: "POST",
      token: driverToken,
      body: { fileName: `${doc.type}.jpg` },
    });
    assert(upload.status === 200, `uploaded ${doc.type}`);
  }

  const vehicle = await api<{ id: string }>("/api/driver/auth/vehicle", {
    method: "POST",
    token: driverToken,
    body: {
      name: "E2E Driver",
      vehicleType: "bike",
      make: "Honda",
      model: "Activa",
      registrationNumber: "KA05EE1234",
      color: "Black",
    },
  });
  assert(vehicle.status === 200 && !!vehicle.data.id, "vehicle details submitted");

  console.log("\n=== Waiting for KYC auto-verification (~4s per document) ===");
  await waitFor(
    async () => {
      const status = await api<string>("/api/driver/auth/verification-status", { token: driverToken });
      return status.data === "verified";
    },
    "driver verification status = verified",
    15000
  );
  log("driver verified", true);

  // ---- Driver goes online, connects a realtime socket ----
  console.log("\n=== Driver goes online ===");
  const online = await api<{ isOnline: boolean }>("/api/driver/status", {
    method: "POST",
    token: driverToken,
    body: { isOnline: true },
  });
  assert(online.data.isOnline === true, "driver toggled online");

  const driverMe = await api<{ id: string }>("/api/driver/auth/me", { token: driverToken });
  const driverId = driverMe.data.id;

  const driverSocket = io(API, { transports: ["websocket"] });
  await new Promise<void>((resolve) => driverSocket.on("connect", () => resolve()));
  driverSocket.emit("join:driver", driverId);
  let socketOffer: { ride: { id: string } } | null = null;
  driverSocket.on("incoming_request", (offer: { ride: { id: string } }) => {
    socketOffer = offer;
  });
  log("driver socket connected and joined driver room", driverSocket.connected);

  // ---- Customer books a ride ----
  console.log("\n=== Customer books a ride ===");
  const pickup = { address: "Test Pickup", point: { lat: 12.9716, lng: 77.5946 } };
  const drop = { address: "Test Drop", point: { lat: 12.99, lng: 77.61 } };

  const fares = await api<Array<{ vehicleType: string; fare: Record<string, number> }>>(
    "/api/customer/fares/estimates",
    {
      token: customerToken,
      query: {
        pickupLat: pickup.point.lat,
        pickupLng: pickup.point.lng,
        dropLat: drop.point.lat,
        dropLng: drop.point.lng,
      },
    }
  );
  assert(fares.data.length === 3, "fare estimates returned for bike/auto/cab");
  const bikeFare = fares.data.find((f) => f.vehicleType === "bike")!;

  const rideRes = await api<{ id: string; status: string; otp: string }>("/api/customer/rides", {
    method: "POST",
    token: customerToken,
    body: { pickup, drop, vehicleType: "bike", fare: bikeFare.fare },
  });
  assert(rideRes.status === 200 && rideRes.data.status === "requested", "ride created with status 'requested'");
  const rideId = rideRes.data.id;

  const customerSocket = io(API, { transports: ["websocket"] });
  await new Promise<void>((resolve) => customerSocket.on("connect", () => resolve()));
  customerSocket.emit("join:ride", rideId);
  let lastRideUpdate: { status: string } | null = null;
  customerSocket.on("ride:updated", (ride: { status: string }) => {
    lastRideUpdate = ride;
  });

  // ---- Matching loop should offer this ride to the online driver within ~1s ----
  console.log("\n=== Waiting for the matching loop to offer the ride to the driver ===");
  await waitFor(async () => socketOffer !== null, "driver receives incoming_request over the socket", 8000);
  assert((socketOffer as unknown as { ride: { id: string } }).ride.id === rideId, "incoming request is for the ride just created");

  const incoming = await api<{ ride: { id: string }; expiresAt: string }>("/api/driver/requests/incoming", {
    token: driverToken,
  });
  assert(incoming.data?.ride.id === rideId, "REST poll also shows the same incoming request");

  // ---- Driver accepts ----
  console.log("\n=== Driver accepts the ride ===");
  const accepted = await api<{ status: string; driverId: string }>(`/api/driver/requests/${rideId}/accept`, {
    method: "POST",
    token: driverToken,
  });
  assert(accepted.data.status === "arriving" && accepted.data.driverId === driverId, "ride accepted, status -> arriving");

  await waitFor(async () => lastRideUpdate?.status === "arriving", "customer receives realtime update: arriving", 5000);
  log("customer socket received arriving update", true);

  const customerRideView = await api<{ status: string; driver: { name: string } | null; otp: string }>(
    `/api/customer/rides/${rideId}/status`,
    { token: customerToken }
  );
  assert(
    customerRideView.data.status === "arriving" && customerRideView.data.driver?.name === "E2E Driver",
    "customer REST view shows arriving with real driver info"
  );
  const rideOtp = customerRideView.data.otp;

  // ---- Driver verifies rider OTP -> in_progress ----
  console.log("\n=== Driver verifies rider OTP ===");
  const otpVerify = await api<{ success: boolean; ride: { status: string } }>(
    `/api/driver/rides/${rideId}/verify-otp`,
    { method: "POST", token: driverToken, body: { otp: rideOtp } }
  );
  assert(otpVerify.data.success && otpVerify.data.ride.status === "in_progress", "OTP verified, status -> in_progress");

  // ---- Driver ends the ride ----
  console.log("\n=== Driver ends the ride ===");
  const ended = await api<{ status: string; fareTotal?: number }>(`/api/driver/rides/${rideId}/end`, {
    method: "POST",
    token: driverToken,
  });
  assert(ended.data.status === "completed", "ride ended, status -> completed");

  await waitFor(async () => lastRideUpdate?.status === "completed", "customer receives realtime update: completed", 5000);
  log("customer socket received completed update", true);

  // ---- Customer rates the ride ----
  console.log("\n=== Customer rates the ride ===");
  const rated = await api<{ rating: number; tip: number }>(`/api/customer/rides/${rideId}/rate`, {
    method: "POST",
    token: customerToken,
    body: { rating: 5, tip: 20 },
  });
  assert(rated.data.rating === 5 && rated.data.tip === 20, "rating + tip saved on the ride");

  // ---- Wallet debited ----
  console.log("\n=== Verifying wallet debit ===");
  const wallet = await api<{ balance: number; transactions: Array<{ category: string }> }>(
    "/api/customer/wallet",
    { token: customerToken }
  );
  const rideDebit = wallet.data.transactions.find((t) => t.category === "ride");
  assert(!!rideDebit, "a 'ride' debit transaction was recorded");
  assert(wallet.data.balance === 500 - (bikeFare.fare as unknown as { total: number }).total, "wallet balance reflects the debit");

  // ---- Driver earnings + history ----
  console.log("\n=== Verifying driver earnings + history ===");
  const history = await api<Array<{ id: string; rating?: number }>>("/api/driver/rides/history", {
    token: driverToken,
  });
  const historyEntry = history.data.find((r) => r.id === rideId);
  assert(!!historyEntry && historyEntry.rating === 5, "completed ride appears in driver history with the real rating");

  const earnings = await api<{ totalRides: number; totalEarnings: number }>("/api/driver/earnings", {
    token: driverToken,
    query: { period: "daily" },
  });
  assert(earnings.data.totalRides >= 1 && earnings.data.totalEarnings > 0, "driver's daily earnings reflect the completed ride");

  const payouts = await api<unknown[]>("/api/driver/earnings/payouts", { token: driverToken });
  assert(payouts.data.length === 3, "payout history seeded");

  driverSocket.close();
  customerSocket.close();

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nE2E TEST FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
