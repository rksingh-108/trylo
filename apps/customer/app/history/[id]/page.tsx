"use client";

import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback, FareBadge, RatingStars, StatusPill } from "@trylo/ui";
import { useRideDetail } from "@trylo/mock-data/hooks";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function RideDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: ride } = useRideDetail(params.id ?? null);

  if (!ride) return null;

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full border border-border"
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-semibold text-foreground">Trip receipt</h1>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {new Date(ride.completedAt ?? ride.requestedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        <StatusPill status={ride.status} />
      </div>

      {ride.driver && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Avatar className="h-11 w-11">
            <AvatarFallback>{initials(ride.driver.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{ride.driver.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ride.driver.vehicle.make} {ride.driver.vehicle.model} · {ride.driver.vehicle.registrationNumber}
            </p>
          </div>
          {ride.rating && <RatingStars value={ride.rating} size={14} />}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="my-1 h-8 w-px border-l border-dashed border-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Pickup</p>
              <p className="text-sm font-medium text-foreground">{ride.pickup.address}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Drop</p>
              <p className="text-sm font-medium text-foreground">{ride.drop.address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Distance</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">{ride.distanceKm} km</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">{ride.durationMin} min</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Base fare</span>
          <span className="text-foreground">₹{ride.fare.base}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Distance</span>
          <span className="text-foreground">₹{ride.fare.distance}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Time</span>
          <span className="text-foreground">₹{ride.fare.time}</span>
        </div>
        {ride.fare.surge > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Surge</span>
            <span className="text-foreground">₹{ride.fare.surge}</span>
          </div>
        )}
        {ride.fare.promoDiscount > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-success">Promo discount</span>
            <span className="text-success">-₹{ride.fare.promoDiscount}</span>
          </div>
        )}
        {Boolean(ride.tip) && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Tip</span>
            <span className="text-foreground">₹{ride.tip}</span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="font-display text-base font-semibold text-foreground">Total paid</span>
          <FareBadge amount={ride.fare.total + (ride.tip ?? 0)} className="text-lg" />
        </div>
      </div>
    </div>
  );
}
