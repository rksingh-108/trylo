/**
 * End-to-end smoke test for the TRYLO backend: drives the full customer + driver
 * lifecycle against a running `pnpm --filter api dev` server using plain fetch and a
 * real socket.io-client connection (so the realtime path is genuinely exercised, not
 * just REST polling). Run with `pnpm --filter api e2e`.
 */
import { io } from "socket.io-client";
import { db } from "../src/db";
import { hashPassword } from "../src/auth/password";

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
let capturedPaymentDriverToken: string | null = null;
let capturedAdminScenarioDriverToken: string | null = null;
let capturedGeoDriverIds: string[] = [];

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

/** Drives a ride from 'requested' through acceptance and OTP verification to 'in_progress'. */
async function progressRideToInProgress(customerToken: string, driverToken: string, rideId: string) {
  await waitFor(
    async () => {
      const acc = await api<{ status: string }>(`/api/driver/requests/${rideId}/accept`, { method: "POST", token: driverToken });
      return acc.status === 200 && acc.data ? acc : null;
    },
    `driver accepts ${rideId}`,
    10000
  );
  const statusRes = await api<{ otp: string }>(`/api/customer/rides/${rideId}/status`, { token: customerToken });
  const verify = await api<{ success: boolean }>(`/api/driver/rides/${rideId}/verify-otp`, {
    method: "POST",
    token: driverToken,
    body: { otp: statusRes.data.otp },
  });
  assert(verify.data.success, `OTP verified for ${rideId}`);
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

  // Take this driver offline so it doesn't compete with the payment-scenario driver
  // for ride offers below.
  await api("/api/driver/status", { method: "POST", token: driverToken, body: { isOnline: false } });
}

/**
 * Exercises the internal payment system end-to-end: successful debit + driver
 * earning on completion, a failed payment when the wallet balance is insufficient
 * (no debit, no earning), and idempotency under both a sequential retry and a
 * genuinely concurrent duplicate /rides/:rideId/end request. Uses its own
 * customers + driver so it doesn't disturb the main happy-path run() above.
 */
async function runPaymentScenarios() {
  console.log("\n=== Payment scenarios ===");
  const suffix = Date.now().toString().slice(-8);
  const richPhone = `9${suffix}5`;
  const poorPhone = `9${suffix}6`;
  const driverPhone = `9${suffix}7`;

  const richOtpReq = await api<{ devHintOtp: string }>("/api/customer/auth/otp/request", {
    method: "POST",
    body: { phone: richPhone },
  });
  const richVerify = await api<{ token: string }>("/api/customer/auth/otp/verify", {
    method: "POST",
    body: { phone: richPhone, otp: richOtpReq.data.devHintOtp },
  });
  const richToken = richVerify.data.token;
  await api("/api/customer/auth/profile", { method: "POST", token: richToken, body: { name: "Rich Payer" } });
  await api("/api/customer/wallet/topup", { method: "POST", token: richToken, body: { amount: 1000 } });

  // A wallet balance of 1 guarantees insufficiency against any bike fare (base fare alone is 15).
  const poorOtpReq = await api<{ devHintOtp: string }>("/api/customer/auth/otp/request", {
    method: "POST",
    body: { phone: poorPhone },
  });
  const poorVerify = await api<{ token: string }>("/api/customer/auth/otp/verify", {
    method: "POST",
    body: { phone: poorPhone, otp: poorOtpReq.data.devHintOtp },
  });
  const poorToken = poorVerify.data.token;
  await api("/api/customer/auth/profile", { method: "POST", token: poorToken, body: { name: "Poor Payer" } });
  await api("/api/customer/wallet/topup", { method: "POST", token: poorToken, body: { amount: 1 } });

  const { token: driverToken } = await onboardVerifiedOnlineDriver(driverPhone, "Payment Test Driver");
  capturedPaymentDriverToken = driverToken;

  const pickup = { address: "Payment Test Pickup", point: { lat: 12.9716, lng: 77.5946 } };
  const drop = { address: "Payment Test Drop", point: { lat: 12.99, lng: 77.61 } };

  // ---- Scenario 1: successful payment ----
  const ride1 = await createRide(richToken, pickup, drop);
  await progressRideToInProgress(richToken, driverToken, ride1);

  const walletBefore1 = await api<{ balance: number }>("/api/customer/wallet", { token: richToken });
  const earningsBefore1 = await api<{ totalEarnings: number; totalRides: number }>("/api/driver/earnings", {
    token: driverToken,
    query: { period: "monthly" },
  });

  const end1 = await api<{ status: string; paymentStatus: string; fare: { total: number } }>(
    `/api/driver/rides/${ride1}/end`,
    { method: "POST", token: driverToken }
  );
  assert(
    end1.data.status === "completed" && end1.data.paymentStatus === "paid",
    "successful payment: ride completed, paymentStatus = paid"
  );

  const walletAfter1 = await api<{ balance: number; transactions: Array<{ rideId?: string }> }>(
    "/api/customer/wallet",
    { token: richToken }
  );
  assert(
    walletAfter1.data.balance === walletBefore1.data.balance - end1.data.fare.total,
    "wallet debited by exactly the fare total"
  );
  assert(
    walletAfter1.data.transactions.filter((t) => t.rideId === ride1).length === 1,
    "exactly one wallet transaction recorded for this ride"
  );

  const earningsAfter1 = await api<{ totalEarnings: number; totalRides: number }>("/api/driver/earnings", {
    token: driverToken,
    query: { period: "monthly" },
  });
  assert(
    earningsAfter1.data.totalEarnings === earningsBefore1.data.totalEarnings + end1.data.fare.total,
    "driver earnings increased by exactly the fare total"
  );
  assert(
    earningsAfter1.data.totalRides === earningsBefore1.data.totalRides + 1,
    "driver's paid-ride count incremented by exactly one"
  );

  // ---- Scenario 2: insufficient wallet balance ----
  const ride2 = await createRide(poorToken, pickup, drop);
  await progressRideToInProgress(poorToken, driverToken, ride2);

  const walletBefore2 = await api<{ balance: number }>("/api/customer/wallet", { token: poorToken });
  const earningsBefore2 = await api<{ totalEarnings: number; totalRides: number }>("/api/driver/earnings", {
    token: driverToken,
    query: { period: "monthly" },
  });

  const end2 = await api<{ status: string; paymentStatus: string }>(`/api/driver/rides/${ride2}/end`, {
    method: "POST",
    token: driverToken,
  });
  assert(
    end2.data.status === "completed" && end2.data.paymentStatus === "failed",
    "insufficient balance: ride still completes, paymentStatus = failed"
  );

  const walletAfter2 = await api<{ balance: number; transactions: Array<{ rideId?: string }> }>(
    "/api/customer/wallet",
    { token: poorToken }
  );
  assert(walletAfter2.data.balance === walletBefore2.data.balance, "wallet balance untouched when payment fails");
  assert(
    !walletAfter2.data.transactions.some((t) => t.rideId === ride2),
    "no wallet transaction recorded for the failed-payment ride"
  );

  const earningsAfter2 = await api<{ totalEarnings: number; totalRides: number }>("/api/driver/earnings", {
    token: driverToken,
    query: { period: "monthly" },
  });
  assert(earningsAfter2.data.totalEarnings === earningsBefore2.data.totalEarnings, "driver earnings unchanged when payment fails");
  assert(earningsAfter2.data.totalRides === earningsBefore2.data.totalRides, "driver's paid-ride count unchanged when payment fails");

  // ---- Scenario 3: duplicate completion request (sequential retry) never double-charges ----
  const ride3 = await createRide(richToken, pickup, drop);
  await progressRideToInProgress(richToken, driverToken, ride3);

  const end3a = await api<{ paymentStatus: string }>(`/api/driver/rides/${ride3}/end`, {
    method: "POST",
    token: driverToken,
  });
  assert(end3a.data.paymentStatus === "paid", "ride3 first completion succeeds and is paid");
  const walletAfter3a = await api<{ balance: number }>("/api/customer/wallet", { token: richToken });

  const end3b = await api<{ status: string; paymentStatus: string }>(`/api/driver/rides/${ride3}/end`, {
    method: "POST",
    token: driverToken,
  });
  assert(
    end3b.data.status === "completed" && end3b.data.paymentStatus === "paid",
    "retried completion request returns the same completed+paid state instead of reprocessing"
  );

  const walletAfter3b = await api<{ balance: number; transactions: Array<{ rideId?: string }> }>(
    "/api/customer/wallet",
    { token: richToken }
  );
  assert(walletAfter3b.data.balance === walletAfter3a.data.balance, "retrying /end does not debit the wallet a second time");
  assert(
    walletAfter3b.data.transactions.filter((t) => t.rideId === ride3).length === 1,
    "retrying /end never creates a second wallet transaction for the same ride"
  );

  // ---- Scenario 4: a genuinely concurrent duplicate /end call never double-charges ----
  const ride4 = await createRide(richToken, pickup, drop);
  await progressRideToInProgress(richToken, driverToken, ride4);

  const walletBefore4 = await api<{ balance: number }>("/api/customer/wallet", { token: richToken });
  const [race4a, race4b] = await Promise.all([
    api<{ status: string }>(`/api/driver/rides/${ride4}/end`, { method: "POST", token: driverToken }),
    api<{ status: string }>(`/api/driver/rides/${ride4}/end`, { method: "POST", token: driverToken }),
  ]);
  assert(
    race4a.data.status === "completed" && race4b.data.status === "completed",
    "both concurrent completion requests see the ride as completed"
  );

  // The loser of the race can observe the ride mid-flight (status flipped to
  // 'completed' but payment not yet processed) — poll until it settles rather
  // than asserting on the race responses themselves.
  const settled4 = await waitFor(
    async () => {
      const status = await api<{ paymentStatus: string; fare: { total: number } }>(
        `/api/customer/rides/${ride4}/status`,
        { token: richToken }
      );
      return status.data.paymentStatus !== "pending" ? status : null;
    },
    "ride4 payment settles to a final status after the race",
    5000
  );
  assert(settled4.data.paymentStatus === "paid", "ride4 payment settles to 'paid' exactly once despite the concurrent race");

  const walletAfter4 = await api<{ balance: number; transactions: Array<{ rideId?: string }> }>(
    "/api/customer/wallet",
    { token: richToken }
  );
  assert(
    walletAfter4.data.balance === walletBefore4.data.balance - settled4.data.fare.total,
    "concurrent duplicate /end calls debit the wallet exactly once, not twice"
  );
  assert(
    walletAfter4.data.transactions.filter((t) => t.rideId === ride4).length === 1,
    "concurrent duplicate /end calls create exactly one wallet transaction"
  );

  // ---- Scenario 5: a cancelled ride creates no payment or earning ----
  const ride5 = await createRide(richToken, pickup, drop);
  const cancel5 = await api<{ status: string; paymentStatus: string }>(`/api/customer/rides/${ride5}/cancel`, {
    method: "POST",
    token: richToken,
    body: { reason: "Changed my mind" },
  });
  assert(
    cancel5.data.status === "cancelled" && cancel5.data.paymentStatus === "pending",
    "a cancelled ride's paymentStatus stays 'pending', never paid or failed"
  );
  const walletAfter5 = await api<{ transactions: Array<{ rideId?: string }> }>("/api/customer/wallet", {
    token: richToken,
  });
  assert(!walletAfter5.data.transactions.some((t) => t.rideId === ride5), "cancelling a ride never creates a wallet transaction");

  await api("/api/driver/status", { method: "POST", token: driverToken, body: { isOnline: false } });
}

/**
 * Onboards a driver up through KYC-doc upload and vehicle submission, but
 * deliberately never polls /kyc or /verification-status — those routes are what
 * lazily trigger the demo auto-verify (see lib/kyc.ts), so skipping them leaves
 * the driver genuinely stuck at verificationStatus 'pending' for the admin
 * approve/reject scenarios below to act on.
 */
async function createUnverifiedDriver(phone: string, name: string): Promise<{ token: string; driverId: string }> {
  const otpReq = await api<{ devHintOtp: string }>("/api/driver/auth/otp/request", { method: "POST", body: { phone } });
  const verify = await api<{ token: string; driver: { id: string } }>("/api/driver/auth/otp/verify", {
    method: "POST",
    body: { phone, otp: otpReq.data.devHintOtp },
  });
  const token = verify.data.token;

  const kycList = await api<Array<{ id: string; type: string }>>("/api/driver/auth/kyc", { token });
  for (const doc of kycList.data) {
    await api(`/api/driver/auth/kyc/${doc.id}/upload`, { method: "POST", token, body: { fileName: `${doc.type}.jpg` } });
  }
  await api("/api/driver/auth/vehicle", {
    method: "POST",
    token,
    body: { name, vehicleType: "bike", make: "Honda", model: "Activa", registrationNumber: "KA05AD0001", color: "Grey" },
  });

  return { token, driverId: verify.data.driver.id };
}

/**
 * Exercises the admin panel end-to-end: role-boundary enforcement (customer/driver
 * tokens rejected on /api/admin/*), dashboard stats, driver approve/reject, customer
 * and driver suspend/unsuspend (including that suspension actually blocks ride
 * creation / going online, not just flips a flag), and ride/payment list filtering.
 * Bootstraps its own throwaway admin via a direct db write — justified because
 * there's intentionally no public admin-signup HTTP endpoint to black-box through;
 * every other assertion here goes through real HTTP calls to /api/admin/*.
 */
async function runAdminScenarios() {
  console.log("\n=== Admin scenarios ===");
  const suffix = Date.now().toString().slice(-8);

  const adminEmail = `e2e-admin-${suffix}@trylo.test`;
  const adminPassword = "E2eAdmin123!";
  await db.admin.create({ data: { email: adminEmail, passwordHash: hashPassword(adminPassword), name: "E2E Admin" } });

  const adminLogin = await api<{ token: string }>("/api/admin/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: adminPassword },
  });
  assert(adminLogin.status === 200 && !!adminLogin.data.token, "admin logs in with email + password");
  const adminToken = adminLogin.data.token;

  // ---- Role-boundary enforcement ----
  const custPhone = `9${suffix}8`;
  const custOtpReq = await api<{ devHintOtp: string }>("/api/customer/auth/otp/request", {
    method: "POST",
    body: { phone: custPhone },
  });
  const custVerify = await api<{ token: string; user: { id: string } }>("/api/customer/auth/otp/verify", {
    method: "POST",
    body: { phone: custPhone, otp: custOtpReq.data.devHintOtp },
  });
  const customerToken = custVerify.data.token;
  const custId = custVerify.data.user.id;
  await api("/api/customer/auth/profile", { method: "POST", token: customerToken, body: { name: "Admin Test Rider" } });

  const { token: bystanderDriverToken } = await createUnverifiedDriver(`9${suffix}9`, "Bystander Driver");
  capturedAdminScenarioDriverToken = bystanderDriverToken;

  const customerOnAdmin = await api("/api/admin/dashboard", { token: customerToken });
  assert(customerOnAdmin.status === 401, "a customer token is rejected on an admin route (401)");

  const driverOnAdmin = await api("/api/admin/dashboard", { token: bystanderDriverToken });
  assert(driverOnAdmin.status === 401, "a driver token is rejected on an admin route (401)");

  const noTokenOnAdmin = await api("/api/admin/dashboard");
  assert(noTokenOnAdmin.status === 401, "an unauthenticated request is rejected on an admin route (401)");

  const adminOnCustomerRoute = await api("/api/customer/auth/me", { token: adminToken });
  assert(adminOnCustomerRoute.status === 401, "an admin token is rejected on a customer route (401)");

  // ---- Dashboard stats ----
  const dashboard = await api<{
    totalCustomers: number;
    totalDrivers: number;
    pendingDriverApprovals: number;
    failedPayments: number;
  }>("/api/admin/dashboard", { token: adminToken });
  assert(dashboard.status === 200, "admin can load the dashboard");
  assert(
    dashboard.data.totalCustomers > 0 && dashboard.data.totalDrivers > 0,
    "dashboard totals reflect real seeded customers and drivers"
  );

  // ---- Driver approve / reject ----
  const { token: pendingApproveToken, driverId: approveDriverId } = await createUnverifiedDriver(`9${suffix}1`, "Approve Me Driver");
  const { driverId: rejectDriverId } = await createUnverifiedDriver(`9${suffix}2`, "Reject Me Driver");

  const beforeApproval = await api<{ verificationStatus: string }>(`/api/admin/drivers/${approveDriverId}`, { token: adminToken });
  assert(beforeApproval.data.verificationStatus === "pending", "a freshly onboarded driver is genuinely still 'pending'");

  const pendingList = await api<{ drivers: Array<{ id: string }>; total: number }>("/api/admin/drivers", {
    token: adminToken,
    query: { verificationStatus: "pending" },
  });
  assert(
    pendingList.data.drivers.some((d) => d.id === approveDriverId),
    "the pending driver appears in the admin's pending-approvals list"
  );

  const approved = await api<{ verificationStatus: string }>(`/api/admin/drivers/${approveDriverId}/approve`, {
    method: "POST",
    token: adminToken,
  });
  assert(approved.data.verificationStatus === "verified", "admin approves a pending driver -> verified");

  // The approved driver can now actually go online, proving this isn't just a display flag.
  const approvedGoesOnline = await api<{ isOnline: boolean }>("/api/driver/status", {
    method: "POST",
    token: pendingApproveToken,
    body: { isOnline: true },
  });
  assert(approvedGoesOnline.data.isOnline === true, "the newly-approved driver can go online");
  await api("/api/driver/status", { method: "POST", token: pendingApproveToken, body: { isOnline: false } });

  const rejected = await api<{ verificationStatus: string }>(`/api/admin/drivers/${rejectDriverId}/reject`, {
    method: "POST",
    token: adminToken,
    body: { reason: "Documents unclear" },
  });
  assert(rejected.data.verificationStatus === "rejected", "admin rejects a pending driver -> rejected");

  // ---- Customer suspend / unsuspend actually blocks platform usage ----
  const suspendCustomer = await api<{ suspended: boolean }>(`/api/admin/customers/${custId}/suspend`, {
    method: "POST",
    token: adminToken,
    body: { reason: "e2e test" },
  });
  assert(suspendCustomer.data.suspended === true, "admin suspends a customer");

  const pickup = { address: "Admin Test Pickup", point: { lat: 12.9716, lng: 77.5946 } };
  const drop = { address: "Admin Test Drop", point: { lat: 12.99, lng: 77.61 } };
  const fares = await api<Array<{ vehicleType: string; fare: Record<string, number> }>>("/api/customer/fares/estimates", {
    token: customerToken,
    query: { pickupLat: pickup.point.lat, pickupLng: pickup.point.lng, dropLat: drop.point.lat, dropLng: drop.point.lng },
  });
  const bikeFare = fares.data.find((f) => f.vehicleType === "bike")!;
  const blockedRide = await api("/api/customer/rides", {
    method: "POST",
    token: customerToken,
    body: { pickup, drop, vehicleType: "bike", fare: bikeFare.fare },
  });
  assert(blockedRide.status === 403, "a suspended customer cannot create a ride (403)");

  const suspendedLoginAttempt = await api<{ success: boolean; reason?: string }>("/api/customer/auth/otp/verify", {
    method: "POST",
    body: {
      phone: custPhone,
      otp: (await api<{ devHintOtp: string }>("/api/customer/auth/otp/request", { method: "POST", body: { phone: custPhone } })).data
        .devHintOtp,
    },
  });
  assert(
    suspendedLoginAttempt.data.success === false && suspendedLoginAttempt.data.reason === "suspended",
    "a suspended customer cannot log in (gets reason: 'suspended')"
  );

  const unsuspendCustomer = await api<{ suspended: boolean }>(`/api/admin/customers/${custId}/unsuspend`, {
    method: "POST",
    token: adminToken,
  });
  assert(unsuspendCustomer.data.suspended === false, "admin unsuspends the customer");

  const rideAfterUnsuspend = await api<{ id: string; status: string }>("/api/customer/rides", {
    method: "POST",
    token: customerToken,
    body: { pickup, drop, vehicleType: "bike", fare: bikeFare.fare },
  });
  assert(rideAfterUnsuspend.status === 200, "the unsuspended customer can create a ride again");
  await api(`/api/customer/rides/${rideAfterUnsuspend.data.id}/cancel`, {
    method: "POST",
    token: customerToken,
    body: { reason: "e2e cleanup" },
  });

  // ---- Driver suspend / unsuspend actually blocks going online ----
  const { token: driverToken, driverId } = await onboardVerifiedOnlineDriver(`9${suffix}3`, "Suspend Me Driver");
  await api("/api/driver/status", { method: "POST", token: driverToken, body: { isOnline: false } });

  const suspendDriver = await api<{ suspended: boolean }>(`/api/admin/drivers/${driverId}/suspend`, {
    method: "POST",
    token: adminToken,
    body: { reason: "e2e test" },
  });
  assert(suspendDriver.data.suspended === true, "admin suspends a driver");

  const blockedOnline = await api("/api/driver/status", { method: "POST", token: driverToken, body: { isOnline: true } });
  assert(blockedOnline.status === 403, "a suspended driver cannot go online (403)");

  const unsuspendDriver = await api<{ suspended: boolean }>(`/api/admin/drivers/${driverId}/unsuspend`, {
    method: "POST",
    token: adminToken,
  });
  assert(unsuspendDriver.data.suspended === false, "admin unsuspends the driver");

  const allowedOnline = await api<{ isOnline: boolean }>("/api/driver/status", {
    method: "POST",
    token: driverToken,
    body: { isOnline: true },
  });
  assert(allowedOnline.data.isOnline === true, "the unsuspended driver can go online again");
  await api("/api/driver/status", { method: "POST", token: driverToken, body: { isOnline: false } });

  // ---- Ride + payment list filtering ----
  const ridesByCustomer = await api<{ rides: Array<{ riderId: string }>; total: number }>("/api/admin/rides", {
    token: adminToken,
    query: { customerId: custId },
  });
  assert(
    ridesByCustomer.data.total > 0 && ridesByCustomer.data.rides.every((r) => r.riderId === custId),
    "admin ride list filters correctly by customerId"
  );

  const failedPaymentRides = await api<{ rides: Array<{ paymentStatus: string }> }>("/api/admin/rides", {
    token: adminToken,
    query: { paymentStatus: "failed" },
  });
  assert(
    failedPaymentRides.data.rides.every((r) => r.paymentStatus === "failed"),
    "admin ride list filters correctly by paymentStatus"
  );

  const walletTxns = await api<{ transactions: unknown[] }>("/api/admin/payments/wallet-transactions", { token: adminToken });
  assert(walletTxns.status === 200, "admin can list wallet transactions");

  const driverEarningsList = await api<{ earnings: unknown[] }>("/api/admin/payments/driver-earnings", { token: adminToken });
  assert(driverEarningsList.status === 200, "admin can list driver earnings");

  const ridesTrend = await api<{ trend: unknown[] }>("/api/admin/analytics/rides-trend", { token: adminToken, query: { period: "daily" } });
  assert(ridesTrend.status === 200, "admin can load the rides analytics trend");
}

// Fixed reference point (matches the CITY_CENTER used to jitter-seed new
// drivers elsewhere in this file), so the km offsets below are known distances.
const GEO_PICKUP = { lat: 12.9716, lng: 77.5946 };
const GEO_KM_TO_DEG_LAT = 1 / 111.32;

function geoOffsetLat(km: number): number {
  return GEO_PICKUP.lat + km * GEO_KM_TO_DEG_LAT;
}

/**
 * Exercises matcher.ts's progressive 1km -> 2km -> 3km candidate-discovery
 * search directly: each case seeds one or two online/verified drivers at
 * exact, known distances/staleness/eligibility relative to a fixed pickup
 * point and asserts exactly which driver (if any) the matching loop offers
 * the ride to. Covers: a tier-1 hit, a tier-2 fallback (tier 1 genuinely
 * empty), a tier-3 fallback (tiers 1-2 genuinely empty), a driver beyond 3km
 * that must never be matched, staleness/offline/suspended/unverified
 * exclusion, that the existing weighted score (distance/rating/acceptance/
 * idle) still picks correctly among same-tier candidates, and - the
 * behavior that most distinguishes "progressive" from "just search 3km" -
 * that a mediocre tier-1 candidate is matched over an objectively
 * better-scoring tier-3 candidate, because tier 2/3 are never even queried
 * once tier 1 returns a non-empty result.
 *
 * Drivers are seeded via a direct DB write rather than the real
 * signup/KYC/OTP HTTP flow other scenarios use: this exercises the
 * candidate SQL query, not driver onboarding (already covered extensively
 * elsewhere in this file), and the exact geometry/staleness/eligibility
 * needed per case can't be produced through the public API anyway (e.g.
 * POST /driver/location always stamps locationUpdatedAt = now()). This
 * mirrors the same justified-direct-write pattern runAdminScenarios()
 * already uses, and also keeps request volume low - going through full
 * onboarding for every case previously tripped the app's global rate
 * limiter (300 req/60s, see app.ts), a test-request-volume problem
 * unrelated to the feature under test.
 */
async function runGeoIndexScenarios() {
  console.log("\n=== Geo-index scenarios (progressive 1km -> 2km -> 3km) ===");
  const suffix = Date.now().toString().slice(-8);
  let driverCounter = 0;
  function nextPhone(): string {
    driverCounter += 1;
    return `9${suffix}${driverCounter}`;
  }

  const customerPhone = `8${suffix}0`;
  const custOtpReq = await api<{ devHintOtp: string }>("/api/customer/auth/otp/request", {
    method: "POST",
    body: { phone: customerPhone },
  });
  const custVerify = await api<{ token: string }>("/api/customer/auth/otp/verify", {
    method: "POST",
    body: { phone: customerPhone, otp: custOtpReq.data.devHintOtp },
  });
  const customerToken = custVerify.data.token;

  async function seedGeoDriver(opts: {
    name: string;
    offsetKm: number;
    isOnline?: boolean;
    verificationStatus?: "pending" | "verified" | "rejected";
    suspended?: boolean;
    locationUpdatedAt?: Date | null;
    rating?: number;
    offeredCount?: number;
    acceptedCount?: number;
  }) {
    const driver = await db.driver.create({
      data: {
        phone: nextPhone(),
        name: opts.name,
        vehicleType: "bike",
        verificationStatus: opts.verificationStatus ?? "verified",
        isOnline: opts.isOnline ?? true,
        onlineSince: new Date(),
        suspended: opts.suspended ?? false,
        lat: geoOffsetLat(opts.offsetKm),
        lng: GEO_PICKUP.lng,
        locationUpdatedAt: opts.locationUpdatedAt === undefined ? new Date() : opts.locationUpdatedAt,
        rating: opts.rating ?? 5,
        offeredCount: opts.offeredCount ?? 0,
        acceptedCount: opts.acceptedCount ?? 0,
      },
    });
    capturedGeoDriverIds.push(driver.id);
    return driver;
  }

  async function createGeoRide(): Promise<string> {
    const rideRes = await api<{ id: string; status: string }>("/api/customer/rides", {
      method: "POST",
      token: customerToken,
      body: {
        pickup: { address: "Geo Test Pickup", point: GEO_PICKUP },
        drop: { address: "Geo Test Drop", point: { lat: GEO_PICKUP.lat + 0.05, lng: GEO_PICKUP.lng + 0.05 } },
        vehicleType: "bike",
        fare: { base: 15, distance: 10, time: 5, surge: 0, promoDiscount: 0, total: 30, currency: "INR" },
      },
    });
    assert(rideRes.status === 200 && rideRes.data.status === "requested", "geo-test ride created");
    return rideRes.data.id;
  }

  /**
   * Polls up to timeoutMs for a driverId to appear; returns null if it never
   * does. Polls at TICK_MS (the matching loop's own cadence) rather than
   * faster - polling in between ticks can't observe a match any sooner, and
   * this scenario's 8 cases already generate a lot of requests, so
   * over-polling risks tripping the app's global rate limiter (300 req/60s,
   * see app.ts) the same way un-throttled onboarding flows did previously.
   */
  async function pollDriverId(rideId: string, timeoutMs: number): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await api<{ driverId: string | null }>(`/api/customer/rides/${rideId}/status`, {
        token: customerToken,
      });
      if (status.data?.driverId) return status.data.driverId;
      await sleep(1000);
    }
    return null;
  }

  async function finishCase(rideId: string, driverIds: string[]) {
    await api(`/api/customer/rides/${rideId}/cancel`, { method: "POST", token: customerToken }).catch(() => {});
    if (driverIds.length > 0) {
      await db.driver.updateMany({ where: { id: { in: driverIds } }, data: { isOnline: false } });
    }
  }

  // ---- Case: driver within 1km (tier 1) is matched ----
  {
    const d = await seedGeoDriver({ name: "Geo Tier1 Driver", offsetKm: 0.6 });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 8000);
    assert(matched === d.id, "driver within 1km (tier 1) is matched", `expected ${d.id}, got ${matched}`);
    await finishCase(rideId, [d.id]);
  }

  // ---- Case: no driver within 1km, driver within 2km (tier 2) is matched ----
  {
    const d = await seedGeoDriver({ name: "Geo Tier2 Driver", offsetKm: 1.5 });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 8000);
    assert(
      matched === d.id,
      "no driver within 1km: search widens to 2km and matches the tier-2 driver",
      `expected ${d.id}, got ${matched}`
    );
    await finishCase(rideId, [d.id]);
  }

  // ---- Case: no driver within 2km, driver within 3km (tier 3) is matched ----
  {
    const d = await seedGeoDriver({ name: "Geo Tier3 Driver", offsetKm: 2.5 });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 8000);
    assert(
      matched === d.id,
      "no driver within 2km: search widens to 3km and matches the tier-3 driver",
      `expected ${d.id}, got ${matched}`
    );
    await finishCase(rideId, [d.id]);
  }

  // ---- Case: driver beyond 3km is never matched - search never widens past the last tier ----
  {
    const d = await seedGeoDriver({ name: "Geo Beyond3km Driver", offsetKm: 4 });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 3000);
    assert(matched === null, "driver beyond 3km is never matched", `expected null, got ${matched}`);
    await finishCase(rideId, [d.id]);
  }

  // ---- Case: stale location (>45s) excludes an otherwise-eligible tier-1 driver ----
  {
    const d = await seedGeoDriver({
      name: "Geo Stale Driver",
      offsetKm: 0.5,
      locationUpdatedAt: new Date(Date.now() - 60_000),
    });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 3000);
    assert(matched === null, "stale-location driver is excluded even within 1km", `expected null, got ${matched}`);
    await finishCase(rideId, [d.id]);
  }

  // ---- Case: offline driver is excluded ----
  {
    const d = await seedGeoDriver({ name: "Geo Offline Driver", offsetKm: 0.5, isOnline: false });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 3000);
    assert(matched === null, "offline driver is excluded even within 1km", `expected null, got ${matched}`);
    await finishCase(rideId, [d.id]);
  }

  // ---- Case: suspended / unverified drivers are excluded ----
  {
    const suspended = await seedGeoDriver({ name: "Geo Suspended Driver", offsetKm: 0.5, suspended: true });
    const unverified = await seedGeoDriver({ name: "Geo Unverified Driver", offsetKm: 0.5, verificationStatus: "pending" });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 3000);
    assert(
      matched === null,
      "suspended and unverified drivers are excluded even within 1km",
      `expected null, got ${matched}`
    );
    await finishCase(rideId, [suspended.id, unverified.id]);
  }

  // ---- Case: existing weighted scoring still applies among same-tier candidates ----
  {
    // Both within 1km (tier 1): a closer but much worse-rated/lower-acceptance
    // driver vs. a slightly farther 5-star driver with a perfect acceptance
    // history. scoreCandidate weights distance 50% / rating 20% / acceptance
    // 20% / idle 10%, so the meaningfully-better driver should still win
    // despite being marginally farther - proving the pre-existing scoring
    // logic (untouched by this change) still runs correctly.
    const closerWorse = await seedGeoDriver({
      name: "Geo Closer Worse",
      offsetKm: 0.2,
      rating: 1,
      offeredCount: 10,
      acceptedCount: 0,
    });
    const fartherBetter = await seedGeoDriver({
      name: "Geo Farther Better",
      offsetKm: 0.95,
      rating: 5,
      offeredCount: 10,
      acceptedCount: 10,
    });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 8000);
    assert(
      matched === fartherBetter.id,
      "existing weighted scoring (rating/acceptance) still picks the better driver over the merely-closer one within the same tier",
      `expected ${fartherBetter.id}, got ${matched}`
    );
    await finishCase(rideId, [closerWorse.id, fartherBetter.id]);
  }

  // ---- Case: progressive search stops at the first non-empty tier, even if a
  // higher-scoring driver exists farther out - the key behavior that
  // distinguishes "progressive 1->2->3km" from "just search a flat 3km". ----
  {
    const tier1Mediocre = await seedGeoDriver({
      name: "Geo Progressive Tier1",
      offsetKm: 0.5,
      rating: 3,
      offeredCount: 10,
      acceptedCount: 1,
    });
    const tier3Excellent = await seedGeoDriver({
      name: "Geo Progressive Tier3",
      offsetKm: 2.5,
      rating: 5,
      offeredCount: 10,
      acceptedCount: 10,
    });
    const rideId = await createGeoRide();
    const matched = await pollDriverId(rideId, 8000);
    assert(
      matched === tier1Mediocre.id,
      "progressive search stops at tier 1 and never considers the tier-3 driver, even though it would score higher",
      `expected ${tier1Mediocre.id}, got ${matched}`
    );
    await finishCase(rideId, [tier1Mediocre.id, tier3Excellent.id]);
  }
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
  await runPaymentScenarios();
  await runAdminScenarios();
  await runGeoIndexScenarios();
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
    if (capturedPaymentDriverToken) {
      await api("/api/driver/status", {
        method: "POST",
        token: capturedPaymentDriverToken,
        body: { isOnline: false },
      }).catch(() => {});
    }
    if (capturedAdminScenarioDriverToken) {
      await api("/api/driver/status", {
        method: "POST",
        token: capturedAdminScenarioDriverToken,
        body: { isOnline: false },
      }).catch(() => {});
    }
    if (capturedGeoDriverIds.length > 0) {
      await db.driver
        .updateMany({ where: { id: { in: capturedGeoDriverIds } }, data: { isOnline: false } })
        .catch(() => {});
    }
    await db.$disconnect().catch(() => {});
    console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
