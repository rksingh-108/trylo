"use client";

import * as React from "react";
import Link from "next/link";
import { Bike, Car, CarTaxiFront, History as HistoryIcon } from "lucide-react";
import { Button, EmptyState, FareBadge, PageTransition, Skeleton, StatusPill } from "@trylo/ui";
import { useRideHistory } from "@trylo/mock-data/hooks";
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
  const { data: rides, isLoading } = useRideHistory();

  return (
    <PageTransition className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">Ride history</h1>

      <div className="mt-5 flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}

        {!isLoading && rides?.length === 0 && (
          <EmptyState
            icon={<HistoryIcon />}
            title="No rides yet"
            description="Book your first ride from Home and it will show up here."
            action={
              <Button asChild>
                <Link href="/home">Book a ride</Link>
              </Button>
            }
          />
        )}

        {rides?.map((ride) => {
          const Icon = VEHICLE_ICONS[ride.vehicleType];
          return (
            <Link
              key={ride.id}
              href={`/history/${ride.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-elevation-1 transition-shadow hover:shadow-elevation-2"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent">
                <Icon size={20} className="text-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{ride.pickup.address}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">→ {ride.drop.address}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {formatDate(ride.completedAt ?? ride.cancelledAt ?? ride.requestedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <FareBadge amount={ride.fare.total} className="text-sm" />
                <StatusPill status={ride.status} />
              </div>
            </Link>
          );
        })}
      </div>
    </PageTransition>
  );
}
