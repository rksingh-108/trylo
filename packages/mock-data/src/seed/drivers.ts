import type { Driver, VehicleType } from "@trylo/types";
import { CITY_CENTER, jitter } from "./geo";

const DRIVER_NAMES = [
  "Ramesh Kumar",
  "Suresh Babu",
  "Anitha Rao",
  "Manjunath Gowda",
  "Farhan Sheikh",
  "Lakshmi Devi",
  "Vikram Singh",
  "Prakash Naik",
];

const VEHICLE_CATALOG: Record<VehicleType, Array<{ make: string; model: string; color: string }>> = {
  bike: [
    { make: "Honda", model: "Activa", color: "Black" },
    { make: "TVS", model: "Jupiter", color: "Blue" },
  ],
  auto: [{ make: "Bajaj", model: "RE Compact", color: "Yellow-Green" }],
  cab: [
    { make: "Maruti Suzuki", model: "Dzire", color: "White" },
    { make: "Hyundai", model: "Aura", color: "Silver" },
  ],
};

function regNumber(): string {
  const state = "KA";
  const code = String(Math.floor(1 + Math.random() * 60)).padStart(2, "0");
  const letters = Array.from({ length: 2 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  const digits = String(Math.floor(1000 + Math.random() * 8999));
  return `${state}${code}${letters}${digits}`;
}

export function generateNearbyDrivers(vehicleType: VehicleType, count = 4): Driver[] {
  const models = VEHICLE_CATALOG[vehicleType];
  return Array.from({ length: count }, (_, i) => {
    const name = DRIVER_NAMES[Math.floor(Math.random() * DRIVER_NAMES.length)] ?? "Driver";
    const model = models[i % models.length] ?? models[0]!;
    return {
      id: `driver_${vehicleType}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      phone: `+91 9${Math.floor(100000000 + Math.random() * 899999999)}`,
      rating: Math.round((3.8 + Math.random() * 1.2) * 10) / 10,
      totalRides: Math.floor(200 + Math.random() * 4000),
      vehicle: {
        id: `veh_${i}`,
        type: vehicleType,
        make: model.make,
        model: model.model,
        registrationNumber: regNumber(),
        color: model.color,
      },
      verificationStatus: "verified",
      isOnline: true,
      location: jitter(CITY_CENTER, 3),
      etaMinutes: Math.floor(2 + Math.random() * 8),
    };
  });
}
