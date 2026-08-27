export type VehicleType = "bike" | "auto" | "cab";

/** A driver-chosen visual style for their live map marker - purely cosmetic, the vehicle icon itself always still reflects VehicleType. */
export type MarkerStyle = "classic" | "arrow" | "beacon" | "compact";

export interface Vehicle {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  registrationNumber: string;
  color: string;
}
