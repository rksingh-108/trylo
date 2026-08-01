"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bike, Car, CarTaxiFront, ChevronLeft, Tag } from "lucide-react";
import { Button, cn, FareBadge, Input } from "@trylo/ui";
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
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full border border-border"
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-semibold text-foreground">Confirm your ride</h1>
      </div>

      <div className="mx-5 mt-4 rounded-xl border border-border bg-card p-4">
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
              <button
                key={estimate.vehicleType}
                type="button"
                onClick={() => setVehicleType(estimate.vehicleType)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-4 text-left transition-colors",
                  isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("grid h-11 w-11 place-items-center rounded-full", isSelected ? "bg-primary/15" : "bg-accent")}>
                    <Icon size={22} className={isSelected ? "text-primary" : "text-foreground"} />
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold text-foreground">{estimate.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {estimate.etaMinutes} min away · {estimate.capacity} seats
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <FareBadge amount={estimate.fare.total} />
                  {estimate.fare.promoDiscount > 0 && <p className="text-xs text-success">Saved ₹{estimate.fare.promoDiscount}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-input px-3">
          <Tag size={16} className="text-muted-foreground" />
          <Input
            placeholder="Promo code"
            className="border-0 px-2 focus-visible:ring-0"
            value={promoCode ?? ""}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase() || null)}
          />
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
