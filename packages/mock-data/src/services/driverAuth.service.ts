import type { Driver, KycDocument, Vehicle, VehicleType } from "@trylo/types";
import { networkDelay, randomId } from "../latency";
import { CITY_CENTER } from "../seed";
import { driverDb } from "../store";

const DEMO_OTP = "1234";

export interface DriverOtpRequestResult {
  requestId: string;
  devHintOtp: string;
}

export async function requestDriverOtp(phone: string): Promise<DriverOtpRequestResult> {
  return networkDelay({ requestId: randomId("otpreq"), devHintOtp: DEMO_OTP });
}

export interface VerifyDriverOtpResult {
  success: boolean;
  isNewDriver: boolean;
  driver: Driver | null;
}

export async function verifyDriverOtp(phone: string, otp: string): Promise<VerifyDriverOtpResult> {
  const success = otp === DEMO_OTP;
  if (!success) return networkDelay({ success: false, isNewDriver: false, driver: null });

  const isNewDriver = !driverDb.driver;
  if (isNewDriver) {
    driverDb.driver = {
      id: randomId("drv"),
      name: "",
      phone,
      rating: 5,
      totalRides: 0,
      vehicle: { id: randomId("veh"), type: "bike", make: "", model: "", registrationNumber: "", color: "" },
      verificationStatus: "pending",
      isOnline: false,
      location: CITY_CENTER,
    };
  }
  return networkDelay({ success: true, isNewDriver, driver: driverDb.driver });
}

export interface VehicleDetailsInput {
  name: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  registrationNumber: string;
  color: string;
}

export async function submitVehicleDetails(input: VehicleDetailsInput): Promise<Driver> {
  if (!driverDb.driver) throw new Error("No authenticated driver");
  const vehicle: Vehicle = {
    id: randomId("veh"),
    type: input.vehicleType,
    make: input.make,
    model: input.model,
    registrationNumber: input.registrationNumber,
    color: input.color,
  };
  driverDb.driver = { ...driverDb.driver, name: input.name, vehicle };
  return networkDelay(driverDb.driver, 400, 700);
}

export async function getKycDocuments(): Promise<KycDocument[]> {
  for (const doc of driverDb.kycDocuments) {
    if (doc.status === "pending_review" && doc.uploadedAt) {
      const elapsed = Date.now() - new Date(doc.uploadedAt).getTime();
      if (elapsed > 4000) doc.status = "verified";
    }
  }
  return networkDelay([...driverDb.kycDocuments]);
}

export async function uploadKycDocument(docId: string, fileName: string): Promise<KycDocument> {
  const doc = driverDb.kycDocuments.find((d) => d.id === docId);
  if (!doc) throw new Error("Unknown document");
  doc.status = "pending_review";
  doc.fileName = fileName;
  doc.uploadedAt = new Date().toISOString();

  if (driverDb.driver && driverDb.driver.verificationStatus === "pending") {
    // stays pending until all docs verified — checked via getVerificationStatus
  }
  return networkDelay({ ...doc }, 500, 900);
}

export async function getVerificationStatus(): Promise<"pending" | "verified" | "rejected"> {
  const allVerified = driverDb.kycDocuments.every((d) => d.status === "verified");
  if (allVerified && driverDb.driver) {
    driverDb.driver.verificationStatus = "verified";
  }
  return networkDelay(driverDb.driver?.verificationStatus ?? "pending", 150, 300);
}

export async function getCurrentDriver(): Promise<Driver | null> {
  return networkDelay(driverDb.driver);
}
