"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button, FareBadge, RatingStars } from "@trylo/ui";
import { useAcceptRideRequest, useRejectRideRequest } from "@trylo/mock-data/hooks";
import type { IncomingRequestOffer } from "@trylo/mock-data";

const OFFER_WINDOW_SECONDS = 15;

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function secondsRemaining(expiresAt: string) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function IncomingRequestOverlay({ offer }: { offer: IncomingRequestOffer }) {
  const router = useRouter();
  const acceptRequest = useAcceptRideRequest();
  const rejectRequest = useRejectRideRequest();
  const [secondsLeft, setSecondsLeft] = React.useState(() => secondsRemaining(offer.expiresAt));

  React.useEffect(() => {
    setSecondsLeft(secondsRemaining(offer.expiresAt));
    const interval = setInterval(() => {
      const remaining = secondsRemaining(offer.expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        rejectRequest.mutate(offer.ride.id);
      }
    }, 500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.expiresAt, offer.ride.id]);

  async function handleAccept() {
    const ride = await acceptRequest.mutateAsync(offer.ride.id);
    if (ride) router.push("/ride");
  }

  function handleReject() {
    rejectRequest.mutate(offer.ride.id);
  }

  const { ride } = offer;
  const progress = Math.max(0, Math.min(1, secondsLeft / OFFER_WINDOW_SECONDS));
  const isBusy = acceptRequest.isPending || rejectRequest.isPending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-foreground">New ride request</h1>
          <span className="font-mono text-2xl font-semibold tabular-nums text-primary">{secondsLeft}s</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${progress * 100}%` }}
            transition={{ ease: "linear", duration: 0.4 }}
          />
        </div>

        {ride.rider && (
          <div className="mt-6 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent font-display text-sm font-semibold text-foreground">
              {initials(ride.rider.name)}
            </span>
            <div>
              <p className="font-medium text-foreground">{ride.rider.name}</p>
              <RatingStars value={ride.rider.rating} size={14} />
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-card p-4">
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

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Distance</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">{ride.distanceKm} km</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">{ride.durationMin} min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fare</p>
            <FareBadge amount={ride.fare.total} className="mt-1 text-sm" />
          </div>
        </div>

        <div className="mt-auto flex gap-3 pt-6">
          <Button variant="outline" size="lg" className="flex-1" onClick={handleReject} disabled={isBusy}>
            <X size={18} />
            Decline
          </Button>
          <Button size="lg" className="flex-1" onClick={handleAccept} disabled={isBusy}>
            <Check size={18} />
            Accept
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
