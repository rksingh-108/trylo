export type VehicleType = "bike" | "auto" | "cab";

export interface Vehicle {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  registrationNumber: string;
  color: string;
}
