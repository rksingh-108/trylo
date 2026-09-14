/**
 * End-to-end eligibility probe: does an online driver actually get *offered* a
 * real customer ride?
 *
 * This is the check that "the driver is online" alone can't prove. The matcher
 * additionally requires a verified, unsuspended driver of the right vehicle
 * type whose last GPS fix is under 45s old, so a driver can be `isOnline: true`
 * and still be invisible to every ride.
 *
 * Usage: npx tsx scripts/qa-offer-check.ts
 */
const API = process.env.API_URL ?? "http://localhost:4000";

async function api<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json: json as T };
}

async function login(phone: string, role: "customer" | "driver") {
  const req = await api<{ devHintOtp?: string }>(`/api/${role}/auth/otp/request`, {
    method: "POST",
    body: { phone },
  });
  const otp = req.json?.devHintOtp;
  if (!otp) throw new Error(`no devHintOtp for ${role} ${phone}: ${JSON.stringify(req.json)}`);
  const verify = await api<{ token?: string; accessToken?: string }>(`/api/${role}/auth/otp/verify`, {
    method: "POST",
    body: { phone, otp },
  });
  const token = verify.json?.token ?? verify.json?.accessToken;
  if (!token) throw new Error(`no token for ${role}: ${JSON.stringify(verify.json)}`);
  return token;
}

const DRIVER_PHONE = process.env.DRIVER_PHONE ?? "9324652008";
const PICKUP = { address: "MG Road, Bengaluru", point: { lat: 12.9716, lng: 77.5946 } };
const DROP = { address: "Koramangala, Bengaluru", point: { lat: 12.9352, lng: 77.6245 } };

async function main() {
  const driverToken = await login(DRIVER_PHONE, "driver");

  const dash = await api<{ isOnline: boolean; driver?: { vehicleType: string } }>("/api/driver/dashboard", {
    token: driverToken,
  });
  const vehicleType = dash.json?.driver?.vehicleType ?? "bike";
  console.log(`driver online=${dash.json?.isOnline} vehicleType=${vehicleType}`);
  if (!dash.json?.isOnline) throw new Error("driver is not online — turn them online first");

  // A fresh customer each run, so there's no leftover active ride to interfere.
  const customerToken = await login(`9${String(Date.now()).slice(-9)}`, "customer");

  // The server re-derives the fare and rejects a breakdown that doesn't match,
  // so a ride can only be booked from a real estimate - same as the app does.
  const estimateRes = await api<Array<{ vehicleType: string; fare: Record<string, number> }>>(
    `/api/customer/fares/estimates?pickupLat=${PICKUP.point.lat}&pickupLng=${PICKUP.point.lng}&dropLat=${DROP.point.lat}&dropLng=${DROP.point.lng}`,
    { token: customerToken }
  );
  const estimate = estimateRes.json?.find((f) => f.vehicleType === vehicleType);
  if (!estimate) throw new Error(`no fare estimate for ${vehicleType}: ${JSON.stringify(estimateRes.json)}`);

  const created = await api<{ id?: string }>("/api/customer/rides", {
    method: "POST",
    token: customerToken,
    body: { pickup: PICKUP, drop: DROP, vehicleType, fare: estimate.fare },
  });
  if (!created.json?.id) throw new Error(`ride creation failed: ${JSON.stringify(created.json)}`);
  console.log(`created ride ${created.json.id}`);

  // The matching loop ticks on an interval; give it a few seconds.
  let offered: { ride?: { id: string } } | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    const incoming = await api<{ ride?: { id: string } }>("/api/driver/requests/incoming", { token: driverToken });
    if (incoming.json?.ride?.id === created.json.id) {
      offered = incoming.json;
      break;
    }
  }

  if (offered) {
    console.log("PASS — online driver was offered the ride the customer booked.");
    await api(`/api/driver/requests/${created.json.id}/reject`, { method: "POST", token: driverToken, body: {} });
  } else {
    console.log("FAIL — driver is online but was never offered a matching ride.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
