export const queryKeys = {
  currentUser: ["currentUser"] as const,
  addresses: (query: string) => ["addresses", query] as const,
  savedPlaces: ["savedPlaces"] as const,
  fareEstimates: (pickupKey: string, dropKey: string, promo?: string) =>
    ["fareEstimates", pickupKey, dropKey, promo ?? null] as const,
  nearbyDrivers: (vehicleType: string) => ["nearbyDrivers", vehicleType] as const,
  activeRide: ["activeRide"] as const,
  rideStatus: (rideId: string) => ["rideStatus", rideId] as const,
  rideHistory: ["rideHistory"] as const,
  rideDetail: (rideId: string) => ["rideDetail", rideId] as const,
  wallet: ["wallet"] as const,
  paymentMethods: ["paymentMethods"] as const,

  currentDriver: ["currentDriver"] as const,
  kycDocuments: ["kycDocuments"] as const,
  verificationStatus: ["verificationStatus"] as const,
  dashboardSummary: ["dashboardSummary"] as const,
  incomingRequest: ["incomingRequest"] as const,
  activeDriverRide: ["activeDriverRide"] as const,
  driverRideHistory: ["driverRideHistory"] as const,
  driverEarnings: (period: string) => ["driverEarnings", period] as const,
  payoutHistory: ["payoutHistory"] as const,
};
