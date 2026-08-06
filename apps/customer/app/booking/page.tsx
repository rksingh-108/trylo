"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bike, Car, CarTaxiFront, ChevronLeft, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { Button, cn, FareBadge, Input, PremiumMap, toast } from "@trylo/ui";
import { useCreateRide, useFareEstimates } from "@trylo/mock-data/hooks";
import type { VehicleType } from "@trylo/types";
import { useBookingStore } from "@/lib/store";

const VEHICLE_ICONS: Record<VehicleType, React.ComponentType<{ size?: number; className?: string }>> = {
  bike: Bike,
  auto: CarTaxiFront,
  cab: Car,
};

export default function BookingPage() {
  const router = useRouter();
  const { pickup, drop, vehicleType, promoCode, setVehicleType, setPromoCode, setActiveRideId } = useBookingStore();
  const [promoInput, setPromoInput] = React.useState(promoCode ?? "");
  const [routeInfo, setRouteInfo] = React.useState<{ distanceKm: number; durationMin: number } | null>(null);
  const prevLoadingRef = React.useRef(false);

  React.useEffect(() => {
    if (!pickup || !drop) router.replace("/home");
  }, [pickup, drop, router]);

  const { data: estimates, isLoading } = useFareEstimates(
    pickup?.point ?? null,
    drop?.point ?? null,
    promoCode || undefined
  );
  const createRide = useCreateRide();

  const effectiveVehicleType = vehicleType ?? estimates?.[0]?.vehicleType;
  const selected = estimates?.find((e) => e.vehicleType === effectiveVehicleType);

  React.useEffect(() => {
    if (!vehicleType && estimates && estimates.length > 0) {
      setVehicleType(estimates[0]!.vehicleType);
    }
  }, [estimates, vehicleType, setVehicleType]);

  React.useEffect(() => {
    if (prevLoadingRef.current && !isLoading && promoCode && selected) {
      if (selected.fare.promoDiscount > 0) {
        toast.success(`Promo applied — you saved ₹${selected.fare.promoDiscount}`);
      } else {
        toast.error("Invalid promo code");
      }
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, promoCode, selected]);

  function handleApplyPromo() {
    const code = promoInput.trim().toUpperCase();
    setPromoCode(code || null);
  }

  async function handleBook() {
    if (!pickup || !drop || !selected) return;
    const ride = await createRide.mutateAsync({
      pickup,
      drop,
      vehicleType: selected.vehicleType,
      fare: selected.fare,
    });
    setActiveRideId(ride.id);
    router.push("/matching");
  }

  if (!pickup || !drop) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-5 pt-5">
        <motion.button
          type="button"
          onClick={() => router.back()}
          whileTap={{ scale: 0.92 }}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card shadow-elevation-1"
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </motion.button>
        <h1 className="font-display text-lg font-semibold text-foreground">Confirm your ride</h1>
      </div>

      <div className="relative mx-5 mt-4 overflow-hidden rounded-2xl shadow-elevation-2">
        <PremiumMap
          className="h-44 w-full"
          pickup={pickup.point}
          drop={drop.point}
          showRoute
          interactive={false}
          showCurrentLocationButton={false}
          zoom={13}
          onRouteInfo={setRouteInfo}
        />
        {routeInfo && (
          <div className="glass-strong absolute bottom-3 left-3 right-3 flex items-center justify-center gap-4 rounded-xl px-3 py-2 shadow-elevation-2">
            <span className="text-xs font-medium text-foreground">{routeInfo.distanceKm} km</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-xs font-medium text-foreground">{routeInfo.durationMin} min</span>
          </div>
        )}
      </div>

      <div className="mx-5 mt-4 rounded-2xl border border-border bg-card p-4 shadow-elevation-1">
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="my-1 h-6 w-px border-l border-dashed border-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Pickup</p>
              <p className="text-sm font-medium text-foreground">{pickup.address}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Drop</p>
              <p className="text-sm font-medium text-foreground">{drop.address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto px-5">
        <p className="mb-2 text-sm font-medium text-foreground">Choose a ride</p>
        <div className="flex flex-col gap-2">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}

          {estimates?.map((estimate) => {
            const Icon = VEHICLE_ICONS[estimate.vehicleType];
            const isSelected = estimate.vehicleType === effectiveVehicleType;
            return (
              <motion.button
                key={estimate.vehicleType}
                type="button"
                onClick={() => setVehicleType(estimate.vehicleType)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative flex items-center justify-between overflow-hidden rounded-xl border p-4 text-left transition-colors",
                  isSelected ? "border-primary" : "border-border bg-card"
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId="vehicle-selected-bg"
                    className="absolute inset-0 bg-primary/5"
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  />
                )}
                <div className="relative flex items-center gap-3">
                  <span className={cn("grid h-11 w-11 place-items-center rounded-full transition-colors", isSelected ? "bg-primary/15" : "bg-accent")}>
                    <Icon size={22} className={isSelected ? "text-primary" : "text-foreground"} />
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold text-foreground">{estimate.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {estimate.etaMinutes} min away · {estimate.capacity} seats
                    </p>
                  </div>
                </div>
                <div className="relative text-right">
                  <FareBadge amount={estimate.fare.total} />
                  {estimate.fare.promoDiscount > 0 && <p className="text-xs text-success">Saved ₹{estimate.fare.promoDiscount}</p>}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-input bg-card px-3 shadow-elevation-1">
          <Tag size={16} className="shrink-0 text-muted-foreground" />
          <Input
            placeholder="Promo code"
            className="border-0 px-2 shadow-none focus-visible:ring-0"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApplyPromo();
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={!promoInput.trim() || promoInput.trim().toUpperCase() === (promoCode ?? "")}
            onClick={handleApplyPromo}
          >
            Apply
          </Button>
        </div>
        {promoCode && selected && selected.fare.promoDiscount === 0 && (
          <p className="mb-2 text-xs text-destructive">Invalid promo code</p>
        )}
        <Button size="lg" className="w-full" disabled={!selected || createRide.isPending} onClick={handleBook}>
          {createRide.isPending ? "Booking..." : selected ? `Book ${selected.label} · ₹${selected.fare.total}` : "Select a ride"}
        </Button>
      </div>
    </div>
  );
}
