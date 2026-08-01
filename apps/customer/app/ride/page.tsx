"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, MessageCircle, Phone } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FareBadge,
  MapPlaceholder,
  RatingStars,
  StatusPill,
} from "@trylo/ui";
import { useRideStatus } from "@trylo/mock-data/hooks";
import { useBookingStore } from "@/lib/store";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function LiveRidePage() {
  const router = useRouter();
  const { activeRideId } = useBookingStore();
  const { data: ride } = useRideStatus(activeRideId);
  const [sosOpen, setSosOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!activeRideId) router.replace("/home");
  }, [activeRideId, router]);

  React.useEffect(() => {
    if (ride?.status === "completed") {
      router.push("/ride/complete");
    }
  }, [ride?.status, router]);

  React.useEffect(() => {
    const interval = setInterval(() => setProgress((p) => (p + 0.05) % 1), 400);
    return () => clearInterval(interval);
  }, []);

  if (!activeRideId || !ride) return null;

  const isArriving = ride.status === "matched" || ride.status === "arriving";
  const driver = ride.driver;

  const from = isArriving ? { x: 15, y: 15 } : { x: 50, y: 28 };
  const to = isArriving ? { x: 50, y: 28 } : { x: 50, y: 72 };
  const liveMarker = {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };

  return (
    <div className="flex flex-1 flex-col">
      <MapPlaceholder
        className="h-64 w-full"
        pickup={{ x: 50, y: 28 }}
        drop={{ x: 50, y: 72 }}
        liveMarker={liveMarker}
        showRoute
      />

      <div className="flex-1 px-5 pb-8 pt-4">
        <div className="flex items-center justify-between">
          <StatusPill status={ride.status} />
          <FareBadge amount={ride.fare.total} />
        </div>

        {driver && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback>{initials(driver.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">{driver.name}</p>
                <RatingStars value={driver.rating} size={12} />
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model} · {driver.vehicle.registrationNumber}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Call driver">
                <Phone size={16} />
              </Button>
              <Button variant="outline" size="icon" aria-label="Message driver">
                <MessageCircle size={16} />
              </Button>
            </div>
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

        <Button variant="destructive" size="lg" className="mt-4 w-full" onClick={() => setSosOpen(true)}>
          <AlertTriangle size={18} />
          SOS
        </Button>
      </div>

      <Dialog open={sosOpen} onOpenChange={setSosOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emergency assistance</DialogTitle>
            <DialogDescription>
              We'll share your live location and trip details with your emergency contacts and local authorities.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="destructive" size="lg" onClick={() => setSosOpen(false)}>
              Alert emergency contacts
            </Button>
            <Button variant="outline" size="lg" onClick={() => setSosOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
