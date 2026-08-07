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

/** Set once the driver token is known, so the outer wrapper can always take the driver offline again. */
let capturedDriverToken: string | null = null;
let capturedCancelDriverToken: string | null = null;

async function onboardVerifiedOnlineDriver(phone: string, name: string): Promise<{ token: string; driverId: string }> {
  const otpReq = await api<{ devHintOtp: string }>("/api/driver/auth/otp/request", {
    method: "POST",
    body: { phone },
  });
  const verify = await api<{ token: string }>("/api/driver/auth/otp/verify", {
    method: "POST",
    body: { phone, otp: otpReq.data.devHintOtp },
  });
  const token = verify.data.token;

  const kycList = await api<Array<{ id: string; type: string }>>("/api/driver/auth/kyc", { token });
  for (const doc of kycList.data) {
    await api(`/api/driver/auth/kyc/${doc.id}/upload`, {
      method: "POST",
      token,
      body: { fileName: `${doc.type}.jpg` },
    });
  }
  await api("/api/driver/auth/vehicle", {
    method: "POST",
    token,
    body: { name, vehicleType: "bike", make: "Honda", model: "Activa", registrationNumber: "KA05EE9999", color: "Black" },
  });
  await waitFor(
    async () => {
      const status = await api<string>("/api/driver/auth/verification-status", { token });
      return status.data === "verified";
    },
    "cancellation-test driver verification status = verified",
    15000
  );
  await api("/api/driver/status", { method: "POST", token, body: { isOnline: true } });
  const me = await api<{ id: string }>("/api/driver/auth/me", { token });
  return { token, driverId: me.data.id };
}

async function createRide(customerToken: string, pickup: { address: string; point: { lat: number; lng: number } }, drop: { address: string; point: { lat: number; lng: number } }) {
  const fares = await api<Array<{ vehicleType: string; fare: Record<string, number> }>>(
    "/api/customer/fares/estimates",
    {
      token: customerToken,
      query: { pickupLat: pickup.point.lat, pickupLng: pickup.point.lng, dropLat: drop.point.lat, dropLng: drop.point.lng },
    }
  );
  const bikeFare = fares.data.find((f) => f.vehicleType === "bike")!;
  const rideRes = await api<{ id: string; status: string }>("/api/customer/rides", {
    method: "POST",
    token: customerToken,
    body: { pickup, drop, vehicleType: "bike", fare: bikeFare.fare },
  });
  return rideRes.data.id;
}

/**
 * Exercises the ride-cancellation feature end-to-end: customer cancel while unmatched,
 * customer cancel while arriving (with the driver seeing the realtime update), driver
 * cancel while arriving (with the customer seeing the realtime update), and the status
 * guards that block cancellation once a ride has reached 'arrived'/'in_progress'.
 * Uses its own customer + driver so it doesn't disturb the main happy-path run() above.
 */
async function runCancellationScenarios() {
  console.log("\n=== Cancellation scenarios ===");
  const suffix = Date.now().toString().slice(-8);
  const customerPhone = `9${suffix}3`;
  const driverPhone = `9${suffix}4`;

  const custOtpReq = await api<{ devHintOtp: string }>("/api/customer/auth/otp/request", {
    method: "POST",
    body: { phone: customerPhone },
  });
  const custVerify = await api<{ token: string }>("/api/customer/auth/otp/verify", {
    method: "POST",
    body: { phone: customerPhone, otp: custOtpReq.data.devHintOtp },
  });
  const customerToken = custVerify.data.token;
  await api("/api/customer/auth/profile", {
    method: "POST",
    token: customerToken,
    body: { name: "Cancellation Rider" },
  });

  const { token: driverToken, driverId } = await onboardVerifiedOnlineDriver(driverPhone, "Cancellation Driver");
  capturedCancelDriverToken = driverToken;

  const driverSocket = io(API, { transports: ["websocket"], auth: { token: driverToken } });
  await new Promise<void>((resolve) => driverSocket.on("connect", () => resolve()));
  driverSocket.emit("join:driver", driverId);
  let lastDriverRideUpdate: { status: string } | null = null;
  driverSocket.on("ride:updated", (ride: { status: string }) => {
    lastDriverRideUpdate = ride;
  });

  const pickup = { address: "Cancel Test Pickup", point: { lat: 12.9716, lng: 77.5946 } };
  const drop = { address: "Cancel Test Drop", point: { lat: 12.99, lng: 77.61 } };

  // ---- Scenario 1: customer cancels an unmatched ('requested') ride ----
  const ride1 = await createRide(customerToken, pickup, drop);
  const cancel1 = await api<{ status: string; cancelledBy: string }>(`/api/customer/rides/${ride1}/cancel`, {
    method: "POST",
    token: customerToken,
    body: { reason: "Changed my mind" },
  });
  assert(
    cancel1.status === 200 && cancel1.data.status === "cancelled" && cancel1.data.cancelledBy === "customer",
    "customer can cancel an unmatched ride, cancelledBy = customer"
  );

  // ---- Scenario 2: customer cancels while the driver is 'arriving'; driver sees it over the socket ----
  const ride2 = await createRide(customerToken, pickup, drop);
  const accepted2 = await waitFor(
    async () => {
      const acc = await api<{ status: string }>(`/api/driver/requests/${ride2}/accept`, { method: "POST", token: driverToken });
      return acc.status === 200 && acc.data ? acc : null;
    },
    "driver accepts ride2",
    10000
  );
  assert(accepted2.data.status === "arriving", "ride2 accepted, status -> arriving");
  driverSocket.emit("join:ride", ride2);
  await sleep(200);

  lastDriverRideUpdate = null;
  const cancel2 = await api<{ status: string; cancelledBy: string }>(`/api/customer/rides/${ride2}/cancel`, {
    method: "POST",
    token: customerToken,
    body: { reason: "Found another ride" },
  });
  assert(
    cancel2.status === 200 && cancel2.data.cancelledBy === "customer",
    "customer can cancel while ride is 'arriving', cancelledBy = customer"
  );
  await waitFor(
    async () => lastDriverRideUpdate?.status === "cancelled",
    "driver receives realtime cancellation update after customer cancels",
    5000
  );
  log("driver socket received cancelled update (customer-initiated)", true);

  // ---- Scenario 3: driver cancels while 'arriving'; customer sees it over the socket ----
  const ride3 = await createRide(customerToken, pickup, drop);
  await waitFor(
    async () => {
      const acc = await api<{ status: string }>(`/api/driver/requests/${ride3}/accept`, { method: "POST", token: driverToken });
      return acc.status === 200 && acc.data ? acc : null;
    },
    "driver accepts ride3",
    10000
  );

  const customerSocket3 = io(API, { transports: ["websocket"], auth: { token: customerToken } });
  await new Promise<void>((resolve) => customerSocket3.on("connect", () => resolve()));
  customerSocket3.emit("join:ride", ride3);
  let lastCustomerRideUpdate: { status: string; cancelledBy?: string } | null = null;
  customerSocket3.on("ride:updated", (ride: { status: string; cancelledBy?: string }) => {
    lastCustomerRideUpdate = ride;
  });

  const driverCancel3 = await api<{ status: string; cancelledBy: string }>(`/api/driver/rides/${ride3}/cancel`, {
    method: "POST",
    token: driverToken,
    body: { reason: "Vehicle issue" },
  });
  assert(
    driverCancel3.status === 200 && driverCancel3.data.cancelledBy === "driver",
    "driver can cancel while ride is 'arriving', cancelledBy = driver"
  );
  await waitFor(
    async () => lastCustomerRideUpdate?.status === "cancelled" && lastCustomerRideUpdate?.cancelledBy === "driver",
    "customer receives realtime cancellation update after driver cancels",
    5000
  );
  log("customer socket received cancelled update (driver-initiated)", true);
  customerSocket3.close();

  // ---- Scenario 4: status guards — customer cannot cancel once 'arrived'; driver still can ----
  const ride4 = await createRide(customerToken, pickup, drop);
  await waitFor(
    async () => {
      const acc = await api<{ status: string }>(`/api/driver/requests/${ride4}/accept`, { method: "POST", token: driverToken });
      return acc.status === 200 && acc.data ? acc : null;
    },
    "driver accepts ride4",
    10000
  );
  await api("/api/driver/location", { method: "POST", token: driverToken, body: { lat: pickup.point.lat, lng: pickup.point.lng } });
  await waitFor(
    async () => {
      const status = await api<{ status: string }>(`/api/customer/rides/${ride4}/status`, { token: customerToken });
      return status.data.status === "arrived" ? status : null;
    },
    "ride4 auto-transitions to 'arrived'",
    5000
  );

  const blockedCancel = await api(`/api/customer/rides/${ride4}/cancel`, {
    method: "POST",
    token: customerToken,
    body: { reason: "Changed my mind" },
  });
  assert(blockedCancel.status === 409, "customer cancel is rejected (409) once the ride has reached 'arrived'");

  const driverCancel4 = await api<{ status: string }>(`/api/driver/rides/${ride4}/cancel`, {
    method: "POST",
    token: driverToken,
    body: { reason: "Rider is not reachable" },
  });
  assert(driverCancel4.status === 200 && driverCancel4.data.status === "cancelled", "driver can still cancel while 'arrived'");

  const repeatCancel = await api(`/api/driver/rides/${ride4}/cancel`, {
    method: "POST",
    token: driverToken,
    body: { reason: "test" },
  });
  assert(repeatCancel.status === 409, "cancelling an already-cancelled ride is rejected (409)");

  driverSocket.close();
}

async function run() {
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
  capturedDriverToken = driverToken;

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

  const driverSocket = io(API, { transports: ["websocket"], auth: { token: driverToken } });
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

  const customerSocket = io(API, { transports: ["websocket"], auth: { token: customerToken } });
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

  // ---- Driver location far from pickup: should NOT trigger arrival ----
  console.log("\n=== Driver location far from pickup (no arrival yet) ===");
  const farLocation = await api("/api/driver/location", {
    method: "POST",
    token: driverToken,
    body: { lat: pickup.point.lat + 0.05, lng: pickup.point.lng + 0.05 }, // ~7.8km away
  });
  assert(farLocation.status === 200, "driver location updated (far from pickup)");

  const stillArriving = await api<{ status: string }>(`/api/customer/rides/${rideId}/status`, {
    token: customerToken,
  });
  assert(stillArriving.data.status === "arriving", "ride still 'arriving' — driver not yet within arrival radius");

  // ---- Driver location within the arrival radius: should auto-transition to 'arrived' ----
  console.log("\n=== Driver arrives at pickup (GPS within radius) ===");
  lastRideUpdate = null;
  const nearLocation = await api("/api/driver/location", {
    method: "POST",
    token: driverToken,
    body: { lat: pickup.point.lat, lng: pickup.point.lng },
  });
  assert(nearLocation.status === 200, "driver location updated (at pickup)");

  await waitFor(async () => lastRideUpdate?.status === "arrived", "customer receives realtime update: arrived", 5000);
  log("customer socket received arrived update", true);

  const arrivedView = await api<{ status: string; arrivedAt?: string }>(
    `/api/customer/rides/${rideId}/status`,
    { token: customerToken }
  );
  assert(
    arrivedView.data.status === "arrived" && !!arrivedView.data.arrivedAt,
    "customer REST view shows 'arrived' with an arrivedAt timestamp"
  );
  const firstArrivedAt = arrivedView.data.arrivedAt;

  // ---- Idempotency: another location ping within radius shouldn't re-trigger or reset arrivedAt ----
  await sleep(300);
  await api("/api/driver/location", {
    method: "POST",
    token: driverToken,
    body: { lat: pickup.point.lat, lng: pickup.point.lng },
  });
  const arrivedAgain = await api<{ status: string; arrivedAt?: string }>(
    `/api/customer/rides/${rideId}/status`,
    { token: customerToken }
  );
  assert(
    arrivedAgain.data.status === "arrived" && arrivedAgain.data.arrivedAt === firstArrivedAt,
    "repeated location pings while waiting don't re-trigger arrival or reset arrivedAt"
  );

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

  // Take this driver offline so it doesn't compete with the cancellation-scenario driver
  // for ride offers below (both are online, verified, and offer the same vehicle type).
  await api("/api/driver/status", { method: "POST", token: driverToken, body: { isOnline: false } });

  await runCancellationScenarios();
}

run()
  .catch((err) => {
    failures++;
    console.error("\nE2E TEST FAILED:", err instanceof Error ? err.message : err);
  })
  .finally(async () => {
    // Always take the test driver back offline, so a failed/interrupted run never leaves it
    // competing (as a stale, disconnected candidate) for rides in a later run.
    if (capturedDriverToken) {
      await api("/api/driver/status", {
        method: "POST",
        token: capturedDriverToken,
        body: { isOnline: false },
      }).catch(() => {});
    }
    if (capturedCancelDriverToken) {
      await api("/api/driver/status", {
        method: "POST",
        token: capturedCancelDriverToken,
        body: { isOnline: false },
      }).catch(() => {});
    }
    console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
