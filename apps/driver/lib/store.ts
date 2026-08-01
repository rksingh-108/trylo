import { create } from "zustand";
import type { GeoPoint } from "@trylo/types";

interface DriverSessionState {
  isOnline: boolean;
  activeRideId: string | null;
  setOnline: (isOnline: boolean) => void;
  setActiveRideId: (rideId: string | null) => void;
}

export const useDriverSessionStore = create<DriverSessionState>((set) => ({
  isOnline: false,
  activeRideId: null,
  setOnline: (isOnline) => set({ isOnline }),
  setActiveRideId: (activeRideId) => set({ activeRideId }),
}));

interface MapState {
  center: GeoPoint | null;
  setCenter: (center: GeoPoint) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: null,
  setCenter: (center) => set({ center }),
}));
