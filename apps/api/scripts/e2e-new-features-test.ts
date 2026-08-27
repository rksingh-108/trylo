/**
 * Focused end-to-end test for the 4 newly added features (push notifications,
 * in-ride chat, cancellation fees, SOS alerts) against a running
 * `pnpm --filter api dev` server. Written as a standalone script (mirroring
 * e2e-test.ts's own style/helpers) rather than editing that file, so the
 * existing, already-passing suite is never put at risk.
 *
 * Run with: npx tsx scripts/e2e-new-features-test.ts
 */
import { io, type Socket } from "socket.io-client";
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
  opts: { method?: string; body?: unknown; token?: string } = {}
): Promise<ApiResult<T>> {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
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

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 15000, intervalMs = 300): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

function connectSocket(token: string): Socket {
  return io(API, { transports: ["websocket"], auth: { token } });
}

const PICKUP = { address: "Test Pickup", point: { lat: 12.9716, lng: 77.5946 } };
const DROP = { address: "Test Drop", point: { lat: 12.9816, lng: 77.6046 } };

async function onboardCustomer(phone: string, topUp = 200) {
  const otp = await api<{ devHintOtp: string }>("/api/customer/auth/otp/request", { method: "POST", body: { phone } });
  const verify = await api<{ token: string; user: { id: string } }>("/api/customer/auth/otp/verify", {
    method: "POST",
    body: { phone, otp: otp.data.devHintOtp },
  });
  const token = verify.data.token;
  await api("/api/customer/auth/profile", { method: "POST", token, body: { name: "Feature Test Rider" } });
  if (topUp > 0) await api("/api/customer/wallet/topup", { method: "POST", token, body: { amount: topUp } });
  return { token, userId: verify.data.user.id };
}

async function onboardDriver(phone: string) {
  const otp = await api<{ devHintOtp: string }>("/api/driver/auth/otp/request", { method: "POST", body: { phone } });
  const verify = await api<{ token: string }>("/api/driver/auth/otp/verify", { method: "POST", body: { phone, otp: otp.data.devHintOtp } });
  const token = verify.data.token;
  const kycList = await api<Array<{ id: string; type: string }>>("/api/driver/auth/kyc", { token });
  for (const doc of kycList.data) {
    await api(`/api/driver/auth/kyc/${doc.id}/upload`, { method: "POST", token, body: { fileName: `${doc.type}.jpg` } });
  }
  await api("/api/driver/auth/vehicle", {
    method: "POST",
    token,
    body: { name: "Feature Test Driver", vehicleType: "bike", make: "Honda", model: "Activa", registrationNumber: "KA05FT0001", color: "Red" },
  });
  // KYC auto-verification (lib/kyc.ts) flips each doc ~4s after its own
  // upload, so this nominally resolves in ~5s. 30s (double the original 15s)
  // gives headroom for CI runner contention after the earlier e2e-test.ts
  // step has already put the shared API/DB under load, without masking a
  // genuine hang - still polls every 300ms via waitFor, no fixed sleep added.
  await waitFor(async () => (await api<string>("/api/driver/auth/verification-status", { token })).data === "verified", "driver verified", 30000);
  await api("/api/driver/status", { method: "POST", token, body: { isOnline: true } });
  await api("/api/driver/location", { method: "POST", token, body: PICKUP.point });
  const me = await api<{ id: string }>("/api/driver/auth/me", { token });
  return { token, driverId: me.data.id };
}

async function createRide(customerToken: string) {
  const url = `/api/customer/fares/estimates?pickupLat=${PICKUP.point.lat}&pickupLng=${PICKUP.point.lng}&dropLat=${DROP.point.lat}&dropLng=${DROP.point.lng}`;
  const fareRes = await api<Array<{ vehicleType: string; fare: Record<string, number> }>>(url, { token: customerToken });
  const bikeFare = fareRes.data.find((f) => f.vehicleType === "bike")!;
  const rideRes = await api<{ id: string }>("/api/customer/rides", {
    method: "POST",
    token: customerToken,
    body: { pickup: PICKUP, drop: DROP, vehicleType: "bike", fare: bikeFare.fare },
  });
  return rideRes.data.id;
}

async function run() {
  const suffix = Date.now().toString().slice(-8);

  // ==========================================================================
  console.log("\n=== Setup: customer + driver, both sockets connected ===");
  const customer = await onboardCustomer(`8${suffix}1`);
  const driver = await onboardDriver(`8${suffix}2`);
  const customerSocket = connectSocket(customer.token);
  const driverSocket = connectSocket(driver.token);
  await new Promise<void>((resolve) => customerSocket.on("connect", () => resolve()));
  await new Promise<void>((resolve) => driverSocket.on("connect", () => resolve()));
  log("customer + driver sockets connected", true);

  // ==========================================================================
  console.log("\n=== 1. Push notifications ===");
  const liveNotifications: unknown[] = [];
  customerSocket.on("notification:new", (n) => liveNotifications.push(n));

  const rideId = await createRide(customer.token);
  customerSocket.emit("join:ride", rideId);
  await sleep(300);

  await waitFor(async () => {
    const list = await api<Array<{ title: string }>>("/api/customer/notifications", { token: customer.token });
    return list.data.some((n) => n.title === "Ride requested") ? list : null;
  }, "'Ride requested' notification persisted for customer");
  log("'Ride requested' notification persisted for customer", true);

  await waitFor(async () => {
    const acc = await api<{ status: string }>(`/api/driver/requests/${rideId}/accept`, { method: "POST", token: driver.token });
    return acc.status === 200 && acc.data ? acc : null;
  }, "driver accepts ride", 10000);
  driverSocket.emit("join:ride", rideId);

  await waitFor(async () => {
    const list = await api<Array<{ title: string }>>("/api/customer/notifications", { token: customer.token });
    return list.data.some((n) => n.title === "Driver assigned") ? list : null;
  }, "'Driver assigned' notification persisted for customer");
  log("'Driver assigned' notification persisted for customer", true);

  assert(
    liveNotifications.some((n) => (n as { title?: string }).title === "Driver assigned" && (n as { forRole?: string }).forRole === "customer"),
    "'Driver assigned' notification pushed live over the ride room, tagged forRole=customer"
  );

  // Arrival now requires REQUIRED_ARRIVAL_CONFIRMATIONS (2) consecutive
  // trustworthy, in-radius pings - see driverRide.routes.ts's POST /location.
  await api("/api/driver/location", { method: "POST", token: driver.token, body: PICKUP.point });
  await api("/api/driver/location", { method: "POST", token: driver.token, body: PICKUP.point });
  await waitFor(async () => {
    const list = await api<Array<{ title: string }>>("/api/customer/notifications", { token: customer.token });
    return list.data.some((n) => n.title === "Driver has arrived") ? list : null;
  }, "'Driver has arrived' notification persisted");
  log("'Driver has arrived' notification persisted (auto-arrival GPS detection)", true);

  const statusRes = await api<{ otp: string }>(`/api/customer/rides/${rideId}/status`, { token: customer.token });
  await api(`/api/driver/rides/${rideId}/verify-otp`, { method: "POST", token: driver.token, body: { otp: statusRes.data.otp } });
  await waitFor(async () => {
    const list = await api<Array<{ title: string }>>("/api/customer/notifications", { token: customer.token });
    return list.data.some((n) => n.title === "Trip started") ? list : null;
  }, "'Trip started' notification persisted");
  log("'Trip started' notification persisted", true);

  await api(`/api/driver/rides/${rideId}/end`, { method: "POST", token: driver.token });
  await waitFor(async () => {
    const custList = await api<Array<{ title: string; body: string }>>("/api/customer/notifications", { token: customer.token });
    const drvList = await api<Array<{ title: string; body: string }>>("/api/driver/notifications", { token: driver.token });
    const custDone = custList.data.some((n) => n.title === "Ride completed");
    const drvDone = drvList.data.some((n) => n.title === "Ride completed");
    return custDone && drvDone ? true : null;
  }, "'Ride completed' notification persisted for BOTH customer and driver");
  log("'Ride completed' notification persisted for both customer and driver", true);

  // Mark-as-read
  const custList = await api<Array<{ id: string; read: boolean }>>("/api/customer/notifications", { token: customer.token });
  const firstUnread = custList.data.find((n) => !n.read)!;
  const markRead = await api<{ success: boolean }>(`/api/customer/notifications/${firstUnread.id}/read`, { method: "POST", token: customer.token });
  assert(markRead.data.success, "customer can mark a single notification as read");
  const afterRead = await api<Array<{ id: string; read: boolean }>>("/api/customer/notifications", { token: customer.token });
  assert(afterRead.data.find((n) => n.id === firstUnread.id)!.read === true, "the marked notification now shows read=true");

  // ==========================================================================
  console.log("\n=== 2. In-ride chat ===");
  const chatRide2 = await createRide(customer.token);
  customerSocket.emit("join:ride", chatRide2);

  // Chat should be rejected while still 'requested' (no driver committed yet).
  const chatBeforeMatch: unknown[] = [];
  driverSocket.on("ride:message:new", (m) => chatBeforeMatch.push(m));
  customerSocket.emit("ride:message", { rideId: chatRide2, body: "Are you close?" });
  await sleep(500);
  assert(chatBeforeMatch.length === 0, "chat message sent before a driver is matched is silently rejected (no broadcast)");
  driverSocket.off("ride:message:new");

  await waitFor(async () => {
    const acc = await api<{ status: string }>(`/api/driver/requests/${chatRide2}/accept`, { method: "POST", token: driver.token });
    return acc.status === 200 && acc.data ? acc : null;
  }, "driver accepts chat-test ride", 10000);
  driverSocket.emit("join:ride", chatRide2);
  await sleep(300);

  // Note: the server broadcasts via `io.to(room)`, which (correctly) echoes back
  // to the sender's own socket too - so each side's received-array will also
  // contain its own outgoing message, not just the other party's. Assert by
  // finding the specific message, not by array position.
  const driverReceived: Array<{ body: string; senderRole: string; rideId: string }> = [];
  const customerReceived: Array<{ body: string; senderRole: string; rideId: string }> = [];
  driverSocket.on("ride:message:new", (m) => driverReceived.push(m));
  customerSocket.on("ride:message:new", (m) => customerReceived.push(m));

  customerSocket.emit("ride:message", { rideId: chatRide2, body: "On my way, see you soon!" });
  await waitFor(async () => (driverReceived.some((m) => m.body === "On my way, see you soon!") ? true : null), "driver receives the customer's chat message live");
  const custMsg = driverReceived.find((m) => m.body === "On my way, see you soon!")!;
  assert(custMsg.senderRole === "customer", "message content/sender correct");

  driverSocket.emit("ride:message", { rideId: chatRide2, body: "Great, waiting outside." });
  await waitFor(async () => (customerReceived.some((m) => m.body === "Great, waiting outside.") ? true : null), "customer receives the driver's chat message live");
  const drvMsg = customerReceived.find((m) => m.body === "Great, waiting outside.")!;
  assert(drvMsg.senderRole === "driver", "reply content/sender correct");

  await sleep(300);
  const custHistory = await api<Array<{ body: string }>>(`/api/customer/rides/${chatRide2}/messages`, { token: customer.token });
  const drvHistory = await api<Array<{ body: string }>>(`/api/driver/rides/${chatRide2}/messages`, { token: driver.token });
  assert(custHistory.data.length === 2 && drvHistory.data.length === 2, "both sides see the full 2-message history via REST", `customer=${custHistory.data.length} driver=${drvHistory.data.length}`);

  // A third party (a different customer) must not be able to read this ride's messages.
  const outsider = await onboardCustomer(`8${suffix}3`, 0);
  const outsiderHistory = await api<Array<{ body: string }>>(`/api/customer/rides/${chatRide2}/messages`, { token: outsider.token });
  assert(outsiderHistory.data.length === 0, "an unrelated customer cannot read this ride's chat history");

  // Finish this ride off so it doesn't linger as the customer's "active ride" and block later tests.
  await progressToInProgressAndEnd(customer.token, driver.token, chatRide2);

  // ==========================================================================
  console.log("\n=== 3. Cancellation fees ===");

  // 3a. Free cancellation while still 'requested'.
  const freeCancelRide = await createRide(customer.token);
  const balanceBeforeFree = (await api<{ balance: number }>("/api/customer/wallet", { token: customer.token })).data.balance;
  const freeCancel = await api<{ status: string }>(`/api/customer/rides/${freeCancelRide}/cancel`, { method: "POST", token: customer.token, body: { reason: "test" } });
  assert(freeCancel.status === 200 && freeCancel.data.status === "cancelled", "free cancellation ('requested') succeeds");
  const balanceAfterFree = (await api<{ balance: number }>("/api/customer/wallet", { token: customer.token })).data.balance;
  assert(balanceAfterFree === balanceBeforeFree, "no fee charged for a free (pre-match) cancellation", `before=${balanceBeforeFree} after=${balanceAfterFree}`);

  // 3b. Late cancellation (after driver accepted) - fee charged.
  const lateCancelRide = await createRide(customer.token);
  await waitFor(async () => {
    const acc = await api<{ status: string }>(`/api/driver/requests/${lateCancelRide}/accept`, { method: "POST", token: driver.token });
    return acc.status === 200 && acc.data ? acc : null;
  }, "driver accepts late-cancel-test ride", 10000);

  const balanceBeforeLate = (await api<{ balance: number }>("/api/customer/wallet", { token: customer.token })).data.balance;
  const lateCancel = await api<{ status: string }>(`/api/customer/rides/${lateCancelRide}/cancel`, { method: "POST", token: customer.token, body: { reason: "test" } });
  assert(lateCancel.status === 200 && lateCancel.data.status === "cancelled", "late cancellation ('arriving') succeeds");
  const balanceAfterLate = (await api<{ balance: number }>("/api/customer/wallet", { token: customer.token })).data.balance;
  assert(balanceBeforeLate - balanceAfterLate === 20, "exactly a ₹20 late-cancellation fee was debited", `before=${balanceBeforeLate} after=${balanceAfterLate}`);

  const feeTxns = await db.walletTransaction.findMany({ where: { rideId: lateCancelRide, category: "cancellation_fee" } });
  assert(feeTxns.length === 1 && feeTxns[0]!.amount === 20, "exactly one cancellation_fee WalletTransaction of amount 20 exists for this ride");

  const feeNotif = await api<Array<{ title: string }>>("/api/customer/notifications", { token: customer.token });
  assert(feeNotif.data.some((n) => n.title === "Cancellation fee charged"), "'Cancellation fee charged' notification was recorded");

  // 3c. Idempotency: cancelling the already-cancelled ride again must not double-charge.
  const retryCancel = await api<{ status: string }>(`/api/customer/rides/${lateCancelRide}/cancel`, { method: "POST", token: customer.token, body: { reason: "retry" } });
  assert(retryCancel.status === 200 && retryCancel.data.status === "cancelled", "retrying cancel on an already-cancelled ride returns 200 with current state (not an error)");
  const feeTxnsAfterRetry = await db.walletTransaction.findMany({ where: { rideId: lateCancelRide, category: "cancellation_fee" } });
  assert(feeTxnsAfterRetry.length === 1, "retrying cancel did NOT create a second fee transaction", `count=${feeTxnsAfterRetry.length}`);
  const balanceAfterRetry = (await api<{ balance: number }>("/api/customer/wallet", { token: customer.token })).data.balance;
  assert(balanceAfterRetry === balanceAfterLate, "wallet balance unchanged by the retried cancel call");

  // 3d. Insufficient balance: cancellation still succeeds, but no fee is charged.
  const poorCustomer = await onboardCustomer(`8${suffix}4`, 5); // only ₹5, less than the ₹20 fee
  const poorRideId = await createRide(poorCustomer.token);
  await waitFor(async () => {
    const acc = await api<{ status: string }>(`/api/driver/requests/${poorRideId}/accept`, { method: "POST", token: driver.token });
    return acc.status === 200 && acc.data ? acc : null;
  }, "driver accepts insufficient-balance-test ride", 10000);
  const poorCancel = await api<{ status: string }>(`/api/customer/rides/${poorRideId}/cancel`, { method: "POST", token: poorCustomer.token });
  assert(poorCancel.status === 200 && poorCancel.data.status === "cancelled", "cancellation succeeds even when the rider can't afford the fee (never trapped in the ride)");
  const poorBalance = (await api<{ balance: number }>("/api/customer/wallet", { token: poorCustomer.token })).data.balance;
  assert(poorBalance === 5, "wallet balance untouched when the fee can't be covered", `balance=${poorBalance}`);

  // ==========================================================================
  console.log("\n=== 4. SOS / emergency alerts ===");
  const admin = await createAdmin(suffix);

  const sosRide = await createRide(customer.token);
  customerSocket.emit("join:ride", sosRide);
  await waitFor(async () => {
    const acc = await api<{ status: string }>(`/api/driver/requests/${sosRide}/accept`, { method: "POST", token: driver.token });
    return acc.status === 200 && acc.data ? acc : null;
  }, "driver accepts SOS-test ride", 10000);
  driverSocket.emit("join:ride", sosRide);

  const sosTooEarly = await api(`/api/customer/rides/${freeCancelRide}/sos`, { method: "POST", token: customer.token, body: {} });
  assert(sosTooEarly.status === 409, "SOS is rejected outside an active ride (e.g. a cancelled ride)", `status=${sosTooEarly.status}`);

  const custSos = await api<{ id: string; createdAt: string }>(`/api/customer/rides/${sosRide}/sos`, {
    method: "POST",
    token: customer.token,
    body: { lat: PICKUP.point.lat, lng: PICKUP.point.lng, note: "feeling unsafe" },
  });
  assert(custSos.status === 200 && !!custSos.data.id, "customer SOS alert created", `status=${custSos.status}`);

  const sosRow = await db.sosAlert.findUnique({ where: { id: custSos.data.id } });
  assert(
    !!sosRow && sosRow.triggeredBy === "customer" && sosRow.riderId === customer.userId && sosRow.driverId === driver.driverId,
    "SosAlert DB row has correct rideId/riderId/driverId/triggeredBy"
  );

  const dedupeSos = await api<{ id: string }>(`/api/customer/rides/${sosRide}/sos`, { method: "POST", token: customer.token, body: {} });
  assert(dedupeSos.data.id === custSos.data.id, "an immediate repeat customer SOS on the same ride is deduped (returns the same alert)");
  const custSosCount = await db.sosAlert.count({ where: { rideId: sosRide, triggeredBy: "customer" } });
  assert(custSosCount === 1, "exactly one customer SosAlert row exists despite the repeat tap", `count=${custSosCount}`);

  const drvSos = await api<{ id: string }>(`/api/driver/rides/${sosRide}/sos`, { method: "POST", token: driver.token, body: {} });
  assert(drvSos.data.id !== custSos.data.id, "a driver SOS on the SAME ride right after the customer's creates its OWN alert (not deduped against the customer's)");
  const totalSosForRide = await db.sosAlert.count({ where: { rideId: sosRide } });
  assert(totalSosForRide === 2, "both the customer's and driver's SOS alerts exist for this ride", `count=${totalSosForRide}`);

  const adminNotifs = await api<Array<{ title: string; body: string }>>("/api/admin/notifications", { token: admin.token });
  const sosNotifCount = adminNotifs.data.filter((n) => n.title.startsWith("SOS:")).length;
  assert(sosNotifCount === 2, "admin received exactly 2 SOS notifications (one per alert, one per admin)", `count=${sosNotifCount}`);

  // The other ride participant must NOT be auto-notified of the SOS (by design - see route comments).
  const driverNotifsAfterSos = await api<Array<{ title: string }>>("/api/driver/notifications", { token: driver.token });
  assert(!driverNotifsAfterSos.data.some((n) => n.title.includes("SOS")), "the driver (other ride participant) was NOT auto-notified of the customer's SOS, by design");

  customerSocket.close();
  driverSocket.close();

  console.log(failures === 0 ? "\nALL NEW-FEATURE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

async function progressToInProgressAndEnd(customerToken: string, driverToken: string, rideId: string) {
  // Arrival now requires REQUIRED_ARRIVAL_CONFIRMATIONS (2) consecutive
  // trustworthy, in-radius pings - see driverRide.routes.ts's POST /location.
  await api("/api/driver/location", { method: "POST", token: driverToken, body: PICKUP.point });
  await api("/api/driver/location", { method: "POST", token: driverToken, body: PICKUP.point });
  await waitFor(async () => {
    const status = await api<{ status: string }>(`/api/customer/rides/${rideId}/status`, { token: customerToken });
    return status.data.status === "arrived" ? status : null;
  }, `ride ${rideId} reaches 'arrived'`, 10000);
  const statusRes = await api<{ otp: string }>(`/api/customer/rides/${rideId}/status`, { token: customerToken });
  await api(`/api/driver/rides/${rideId}/verify-otp`, { method: "POST", token: driverToken, body: { otp: statusRes.data.otp } });
  await api(`/api/driver/rides/${rideId}/end`, { method: "POST", token: driverToken });
}

async function createAdmin(suffix: string) {
  const email = `feature-test-admin-${suffix}@trylo.test`;
  const password = "FeatureTest123!";
  await db.admin.create({ data: { email, passwordHash: hashPassword(password), name: "Feature Test Admin" } });
  const login = await api<{ token: string }>("/api/admin/auth/login", { method: "POST", body: { email, password } });
  return { token: login.data.token };
}

run().catch(async (err) => {
  console.error("\n💥", err instanceof Error ? err.message : err);
  await db.$disconnect();
  process.exit(1);
});
