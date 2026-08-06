"use client";

import { Bike, Car, CarTaxiFront, PackageOpen } from "lucide-react";
import { Card, CardContent, EmptyState, RatingStars, Skeleton } from "@trylo/ui";
import { useDriverRideHistory } from "@trylo/mock-data/hooks";
import type { VehicleType } from "@trylo/types";

const VEHICLE_ICONS: Record<VehicleType, React.ComponentType<{ size?: number; className?: string }>> = {
  bike: Bike,
  auto: CarTaxiFront,
  cab: Car,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function HistoryPage() {
  const { data: rides, isLoading } = useDriverRideHistory();

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">Ride history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every completed trip, in one place.</p>

      <div className="mt-5 flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}

        {!isLoading && rides?.length === 0 && (
          <EmptyState
            icon={<PackageOpen />}
            title="No completed rides yet"
            description="Your finished trips will show up here once you start driving."
          />
        )}

        {rides?.map((ride, i) => {
          const Icon = VEHICLE_ICONS[ride.vehicleType];
          return (
            <Card
              key={ride.id}
              variant="default"
              className="animate-slide-up"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: "backwards" }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent">
                  <Icon size={20} className="text-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{ride.rider?.name ?? "Rider"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(ride.completedAt ?? ride.requestedAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-sm font-semibold text-primary">₹{ride.fare.total}</span>
                  {ride.rating && <RatingStars value={ride.rating} size={12} />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
