import { create } from "zustand";
import type { GeoPoint, VehicleType } from "@trylo/types";

interface BookingState {
  pickup: { address: string; point: GeoPoint } | null;
  drop: { address: string; point: GeoPoint } | null;
  vehicleType: VehicleType | null;
  promoCode: string | null;
  activeRideId: string | null;
  setPickup: (pickup: BookingState["pickup"]) => void;
  setDrop: (drop: BookingState["drop"]) => void;
  setVehicleType: (vehicleType: VehicleType | null) => void;
  setPromoCode: (promoCode: string | null) => void;
  setActiveRideId: (rideId: string | null) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  pickup: null,
  drop: null,
  vehicleType: null,
  promoCode: null,
  activeRideId: null,
  setPickup: (pickup) => set({ pickup }),
  setDrop: (drop) => set({ drop }),
  setVehicleType: (vehicleType) => set({ vehicleType }),
  setPromoCode: (promoCode) => set({ promoCode }),
  setActiveRideId: (activeRideId) => set({ activeRideId }),
  reset: () => set({ pickup: null, drop: null, vehicleType: null, promoCode: null, activeRideId: null }),
}));

interface MapState {
  center: GeoPoint | null;
  setCenter: (center: GeoPoint) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: null,
  setCenter: (center) => set({ center }),
}));
