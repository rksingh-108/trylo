import type { Driver, GeoPoint } from "./driver";
import type { VehicleType } from "./vehicle";

export type RideStatus =
  | "requested"
  | "matched"
  | "arriving"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface RideLocation {
  address: string;
  point: GeoPoint;
}

export interface RiderSummary {
  name: string;
  rating: number;
}

export interface Ride {
  id: string;
  status: RideStatus;
  vehicleType: VehicleType;
  pickup: RideLocation;
  drop: RideLocation;
  driverId?: string;
  /** Expanded driver details, populated once the ride is matched. */
  driver?: Driver;
  riderId: string;
  /** Expanded rider details, shown to the driver on requests and active rides. */
  rider?: RiderSummary;
  fare: FareBreakdown;
  otp: string;
  distanceKm: number;
  durationMin: number;
  requestedAt: string;
  matchedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  rating?: number;
  tip?: number;
}

export interface FareBreakdown {
  base: number;
  distance: number;
  time: number;
  surge: number;
  promoDiscount: number;
  total: number;
  currency: "INR";
}

export interface FareEstimate {
  vehicleType: VehicleType;
  fare: FareBreakdown;
  etaMinutes: number;
  capacity: number;
  label: string;
  description: string;
}

export interface PromoCode {
  code: string;
  description: string;
  discountPercent: number;
  maxDiscount: number;
}
