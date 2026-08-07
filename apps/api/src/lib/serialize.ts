import type {
  Driver as PrismaDriver,
  KycDocument as PrismaKycDocument,
  Ride as PrismaRide,
  User as PrismaUser,
} from "@prisma/client";
import type { Driver, KycDocument, Ride } from "@trylo/types";
import { haversineKm } from "./geo";

export function serializeDriver(driver: PrismaDriver): Driver {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    rating: driver.rating,
    totalRides: driver.totalRides,
    vehicle: {
      id: `veh_${driver.id}`,
      type: driver.vehicleType,
      make: driver.make,
      model: driver.model,
      registrationNumber: driver.registrationNumber,
      color: driver.color,
    },
    verificationStatus: driver.verificationStatus,
    isOnline: driver.isOnline,
    location: { lat: driver.lat, lng: driver.lng },
  };
}

export function serializeKycDocument(doc: PrismaKycDocument): KycDocument {
  return {
    id: doc.id,
    type: doc.type,
    label: doc.label,
    status: doc.status,
    fileName: doc.fileName ?? undefined,
    uploadedAt: doc.uploadedAt?.toISOString(),
  };
}

type RideWithRelations = PrismaRide & {
  driver?: PrismaDriver | null;
  rider?: PrismaUser | null;
};

export function serializeRide(ride: RideWithRelations): Ride {
  let driver: Driver | undefined;
  if (ride.driver) {
    driver = serializeDriver(ride.driver);
    const distanceKm = haversineKm(ride.driver, { lat: ride.pickupLat, lng: ride.pickupLng });
    driver.etaMinutes = Math.max(2, Math.round((distanceKm / 25) * 60));
  }

  return {
    id: ride.id,
    status: ride.status,
    vehicleType: ride.vehicleType,
    pickup: { address: ride.pickupAddress, point: { lat: ride.pickupLat, lng: ride.pickupLng } },
    drop: { address: ride.dropAddress, point: { lat: ride.dropLat, lng: ride.dropLng } },
    driverId: ride.driverId ?? undefined,
    driver,
    riderId: ride.riderId,
    rider: ride.rider ? { name: ride.rider.name, rating: ride.rider.rating } : undefined,
    fare: {
      base: ride.fareBase,
      distance: ride.fareDistance,
      time: ride.fareTime,
      surge: ride.fareSurge,
      promoDiscount: ride.farePromoDiscount,
      total: ride.fareTotal,
      currency: "INR",
    },
    otp: ride.otp,
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    requestedAt: ride.requestedAt.toISOString(),
    matchedAt: ride.acceptedAt?.toISOString(),
    arrivedAt: ride.arrivedAt?.toISOString(),
    startedAt: ride.startedAt?.toISOString(),
    completedAt: ride.completedAt?.toISOString(),
    cancelledAt: ride.cancelledAt?.toISOString(),
    cancelReason: ride.cancelReason ?? undefined,
    rating: ride.rating ?? undefined,
    tip: ride.tip ?? undefined,
  };
}
