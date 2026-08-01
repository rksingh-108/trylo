"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Car, MessageCircle, Phone, X } from "lucide-react";
import { Avatar, AvatarFallback, Button, FareBadge, RatingStars } from "@trylo/ui";
import { useCancelRide, useRideStatus } from "@trylo/mock-data/hooks";
import { useBookingStore } from "@/lib/store";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function MatchingPage() {
  const router = useRouter();
  const { activeRideId, reset } = useBookingStore();

  React.useEffect(() => {
    if (!activeRideId) router.replace("/home");
  }, [activeRideId, router]);

  const { data: ride } = useRideStatus(activeRideId);
  const cancelRide = useCancelRide();

  async function handleCancel() {
    if (!activeRideId) return;
    await cancelRide.mutateAsync({ rideId: activeRideId, reason: "Cancelled by rider while searching" });
    reset();
    router.replace("/home");
  }

  if (!activeRideId) return null;

  const isSearching = !ride || ride.status === "requested";
  const driver = ride?.driver;

  return (
    <div className="flex flex-1 flex-col">
      <AnimatePresence>
        {isSearching ? (
          <motion.div
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center"
          >
            <div className="relative flex h-40 w-40 items-center justify-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20 [animation-delay:0.6s]" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20 [animation-delay:1.2s]" />
              <span className="relative grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Car size={26} />
              </span>
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">Finding your driver</h1>
              <p className="mt-1 text-sm text-muted-foreground">Hang tight, matching you with nearby drivers...</p>
            </div>
            <Button variant="outline" onClick={handleCancel} disabled={cancelRide.isPending}>
              <X size={16} />
              Cancel ride
            </Button>
          </motion.div>
        ) : driver ? (
          <motion.div
            key="matched"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="mt-auto flex flex-col gap-5 rounded-t-2xl border-t border-border bg-card px-6 pb-8 pt-6"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <p className="text-sm font-medium text-success">Driver on the way</p>
            </div>

            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback>{initials(driver.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-display text-lg font-semibold text-foreground">{driver.name}</p>
                <RatingStars value={driver.rating} size={14} />
                <p className="mt-1 text-sm text-muted-foreground">
                  {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-semibold text-foreground">{driver.etaMinutes}</p>
                <p className="text-xs text-muted-foreground">min away</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="font-mono text-sm font-medium tracking-widest text-foreground">
                {driver.vehicle.registrationNumber}
              </span>
              {ride && <FareBadge amount={ride.fare.total} />}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Call driver">
                <Phone size={18} />
              </Button>
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Message driver">
                <MessageCircle size={18} />
              </Button>
              <Button size="lg" className="flex-1" onClick={() => router.push("/ride")}>
                Track ride
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
