"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Car, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FareBadge,
  PageTransition,
  PremiumMap,
  RatingStars,
  StatusPill,
  type RouteInfo,
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
  const [routeInfo, setRouteInfo] = React.useState<RouteInfo | null>(null);

  React.useEffect(() => {
    if (!activeRideId) router.replace("/home");
  }, [activeRideId, router]);

  React.useEffect(() => {
    if (ride?.status === "completed") {
      router.push("/ride/complete");
    }
  }, [ride?.status, router]);

  if (!activeRideId || !ride) return null;

  const driver = ride.driver;
  const showOtp = Boolean(driver) && ride.status !== "in_progress";

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <PremiumMap
          className="h-72 w-full"
          pickup={ride.pickup.point}
          drop={ride.drop.point}
          liveMarker={driver?.location}
          showRoute
          onRouteInfo={setRouteInfo}
        />

        <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between">
          <StatusPill status={ride.status} className="pointer-events-auto shadow-elevation-2" />
          {routeInfo && (
            <span className="pointer-events-auto glass-strong rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-elevation-2">
              {routeInfo.distanceKm} km · {routeInfo.durationMin} min
            </span>
          )}
        </div>
      </div>

      <PageTransition className="flex-1 px-5 pb-8 pt-4">
        <div className="flex items-center justify-end">
          <FareBadge amount={ride.fare.total} />
        </div>

        {driver && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-elevation-2"
          >
            <div className="flex items-center gap-3 p-4">
              <Avatar className="h-14 w-14 shrink-0 border-2 border-background shadow-elevation-1">
                {driver.avatarUrl && <AvatarImage src={driver.avatarUrl} alt={driver.name} />}
                <AvatarFallback>{initials(driver.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">{driver.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <RatingStars value={driver.rating} size={13} />
                  <span className="text-xs text-muted-foreground">{driver.rating.toFixed(1)}</span>
                </div>
              </div>
              {typeof driver.etaMinutes === "number" && (
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xl font-semibold text-foreground">{driver.etaMinutes}</p>
                  <p className="text-[11px] text-muted-foreground">min ETA</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/40 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background shadow-elevation-1">
                  <Car size={15} className="text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
                  </p>
                  <p className="font-mono text-xs font-semibold tracking-widest text-foreground">
                    {driver.vehicle.registrationNumber}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Call driver">
                  <Phone size={15} />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Message driver">
                  <MessageCircle size={15} />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {showOtp && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
              Share this OTP to start the ride
            </p>
            <div className="mt-3 flex items-center justify-center gap-2.5">
              {ride.otp.split("").map((digit, i) => (
                <span
                  key={i}
                  className="grid h-12 w-10 place-items-center rounded-xl border border-primary/30 bg-background font-mono text-2xl font-bold text-foreground shadow-elevation-1"
                >
                  {digit}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/15">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span className="my-1 h-8 w-px border-l border-dashed border-border" />
              <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-600/15">
                <MapPin size={11} className="text-teal-600" />
              </span>
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
            {ride.status === "in_progress" && (
              <span className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full bg-primary/10">
                <Navigation size={14} className="text-primary" />
              </span>
            )}
          </div>
        </div>

        <Button variant="destructive" size="lg" className="mt-4 w-full" onClick={() => setSosOpen(true)}>
          <AlertTriangle size={18} />
          SOS
        </Button>
      </PageTransition>

      <Dialog open={sosOpen} onOpenChange={setSosOpen}>
        <DialogContent>
          <DialogHeader className="items-center text-center">
            <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-destructive/15">
              <AlertTriangle size={22} className="text-destructive" />
            </span>
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
