"use client";

import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card, Skeleton } from "@trylo/ui";
import { useAdminRide } from "@trylo/mock-data/hooks";

export default function AdminRideDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: ride, isLoading } = useAdminRide(params.id ?? null);

  if (isLoading || !ride) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/rides")}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Back to rides
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Ride {ride.id.slice(-8)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{new Date(ride.requestedAt).toLocaleString("en-IN")}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{ride.status}</Badge>
          <Badge variant={ride.paymentStatus === "paid" ? "success" : ride.paymentStatus === "failed" ? "destructive" : "outline"}>
            {ride.paymentStatus}
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rider</p>
          <p className="mt-2 font-display text-lg font-semibold text-foreground">{ride.rider?.name ?? "—"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Rating {ride.rider?.rating.toFixed(1) ?? "—"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Driver</p>
          {ride.driver ? (
            <>
              <p className="mt-2 font-display text-lg font-semibold text-foreground">{ride.driver.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {ride.driver.vehicle.make} {ride.driver.vehicle.model} · {ride.driver.vehicle.registrationNumber}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not yet matched</p>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trip</p>
        <div className="mt-3 flex gap-3">
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
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Distance</p>
            <p className="font-mono text-sm font-semibold text-foreground">{ride.distanceKm} km</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-mono text-sm font-semibold text-foreground">{ride.durationMin} min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vehicle</p>
            <p className="font-mono text-sm font-semibold text-foreground">{ride.vehicleType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rating</p>
            <p className="font-mono text-sm font-semibold text-foreground">{ride.rating ?? "—"}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fare breakdown</p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base fare</span>
            <span className="font-mono text-foreground">₹{ride.fare.base}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Distance</span>
            <span className="font-mono text-foreground">₹{ride.fare.distance}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-mono text-foreground">₹{ride.fare.time}</span>
          </div>
          {ride.fare.surge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Surge</span>
              <span className="font-mono text-foreground">₹{ride.fare.surge}</span>
            </div>
          )}
          {ride.fare.promoDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-success">Promo discount</span>
              <span className="font-mono text-success">-₹{ride.fare.promoDiscount}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <span className="text-foreground">Total</span>
            <span className="font-mono text-foreground">₹{ride.fare.total}</span>
          </div>
        </div>
      </Card>

      {ride.status === "cancelled" && (
        <Card className="mt-4 border-destructive/30 bg-destructive/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-destructive">Cancellation</p>
          <p className="mt-2 text-sm text-foreground">
            Cancelled by {ride.cancelledBy ?? "unknown"}
            {ride.cancelReason ? ` — ${ride.cancelReason}` : ""}
          </p>
          {ride.cancelledAt && (
            <p className="mt-1 text-xs text-muted-foreground">{new Date(ride.cancelledAt).toLocaleString("en-IN")}</p>
          )}
        </Card>
      )}
    </div>
  );
}
