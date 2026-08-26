"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, MapPin, Navigation, X } from "lucide-react";
import { Button, Card, FareBadge, RatingStars, toast } from "@trylo/ui";
import { useAcceptRideRequest, useRejectRideRequest } from "@trylo/mock-data/hooks";
import type { IncomingRequestOffer } from "@trylo/mock-data";

const OFFER_WINDOW_SECONDS = 15;

type Urgency = "calm" | "warning" | "critical";

const URGENCY_STYLES: Record<Urgency, { text: string; bar: string; ring: string; badgeBg: string; glow: string }> = {
  calm: {
    text: "text-primary",
    bar: "bg-primary",
    ring: "ring-primary/25",
    badgeBg: "bg-primary/10",
    glow: "shadow-glow-sm",
  },
  warning: {
    text: "text-amber-500",
    bar: "bg-amber-500",
    ring: "ring-amber-500/30",
    badgeBg: "bg-amber-500/10",
    glow: "shadow-[0_4px_18px_-4px_rgba(245,158,11,0.5)]",
  },
  critical: {
    text: "text-destructive",
    bar: "bg-destructive",
    ring: "ring-destructive/35",
    badgeBg: "bg-destructive/10",
    glow: "shadow-[0_4px_20px_-3px_rgba(239,68,68,0.55)]",
  },
};

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

function urgencyOf(secondsLeft: number): Urgency {
  if (secondsLeft <= 5) return "critical";
  if (secondsLeft <= 10) return "warning";
  return "calm";
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
    if (ride) {
      router.push("/ride");
    } else {
      toast.error("Ride no longer available", { description: "This request was taken or expired." });
    }
  }

  function handleReject() {
    rejectRequest.mutate(offer.ride.id);
  }

  const { ride } = offer;
  const progress = Math.max(0, Math.min(1, secondsLeft / OFFER_WINDOW_SECONDS));
  const isBusy = acceptRequest.isPending || rejectRequest.isPending;
  const urgency = urgencyOf(secondsLeft);
  const tone = URGENCY_STYLES[urgency];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Urgency accent glow at the very top of the sheet */}
      <motion.div
        aria-hidden
        className={`h-1 w-full ${tone.bar}`}
        animate={{ opacity: urgency === "critical" ? [0.5, 1, 0.5] : 1 }}
        transition={{ duration: 0.9, repeat: urgency === "critical" ? Infinity : 0, ease: "easeInOut" }}
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pb-8 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Incoming</p>
            <h1 className="font-display text-xl font-semibold text-foreground">New ride request</h1>
          </div>

          <motion.div
            animate={urgency === "critical" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.7, repeat: urgency === "critical" ? Infinity : 0, ease: "easeInOut" }}
            className={`grid h-14 w-14 place-items-center rounded-full ring-4 transition-colors duration-300 ${tone.badgeBg} ${tone.ring}`}
          >
            <span className={`font-mono text-xl font-bold tabular-nums ${tone.text}`}>{secondsLeft}</span>
          </motion.div>
        </motion.div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full ${tone.bar}`}
            animate={{ width: `${progress * 100}%` }}
            transition={{ ease: "linear", duration: 0.4 }}
          />
        </div>

        {ride.rider && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
            className="mt-6 flex items-center gap-3"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-semibold text-foreground">
              {initials(ride.rider.name)}
            </span>
            <div>
              <p className="font-medium text-foreground">{ride.rider.name}</p>
              <RatingStars value={ride.rider.rating} size={14} />
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
        >
          <Card variant="elevated" className="mt-6 p-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500/15">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <span className="my-1 h-8 w-px border-l border-dashed border-border" />
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-600/15">
                  <MapPin size={12} className="text-teal-600" />
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
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
        >
          <Card variant="elevated" className="mt-4 grid grid-cols-3 gap-3 p-4 text-center">
            <div>
              <Navigation size={14} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">{ride.distanceKm} km</p>
            </div>
            <div className="border-x border-border">
              <p className="mb-1 text-xs text-muted-foreground opacity-0">·</p>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">{ride.durationMin} min</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground opacity-0">·</p>
              <p className="text-xs text-muted-foreground">Fare</p>
              <FareBadge amount={ride.fare.total} className="mt-0.5 text-base" />
            </div>
          </Card>
        </motion.div>

        <div className="mt-auto flex gap-3 pt-6">
          <Button
            variant="outline"
            size="lg"
            className="h-16 flex-1 border-destructive/30 text-base text-destructive hover:bg-destructive/10"
            onClick={handleReject}
            disabled={isBusy}
          >
            <X size={20} />
            Decline
          </Button>
          <Button
            variant="glow"
            size="lg"
            className="h-16 flex-[1.2] text-base"
            onClick={handleAccept}
            disabled={isBusy}
          >
            <Check size={20} />
            Accept
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
