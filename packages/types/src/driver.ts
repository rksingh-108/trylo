import type { Vehicle } from "./vehicle";

export type DriverVerificationStatus = "pending" | "verified" | "rejected";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  rating: number;
  totalRides: number;
  vehicle: Vehicle;
  verificationStatus: DriverVerificationStatus;
  isOnline: boolean;
  location: GeoPoint;
  etaMinutes?: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface KycDocument {
  id: string;
  type: "license" | "rc" | "insurance" | "profile_photo";
  label: string;
  status: "not_uploaded" | "pending_review" | "verified" | "rejected";
  fileName?: string;
  uploadedAt?: string;
}
