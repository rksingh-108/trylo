"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, MessageCircle, Navigation2, Phone, Route, ShieldCheck } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AnimatedCounter,
  Button,
  Card,
  CardContent,
  FareBadge,
  OtpInput,
  PremiumMap,
  RatingStars,
  StatusPill,
} from "@trylo/ui";
import type { RouteInfo } from "@trylo/ui";
import { useActiveDriverRide, useEndRide, useReportLiveLocation, useVerifyRiderOtp } from "@trylo/mock-data/hooks";
import type { Ride } from "@trylo/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ActiveRidePage() {
  const router = useRouter();
  const { data: ride } = useActiveDriverRide();
  const verifyOtp = useVerifyRiderOtp();
  const endRide = useEndRide();
  const liveGpsLocation = useReportLiveLocation(Boolean(ride));

  const [otp, setOtp] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [completedRide, setCompletedRide] = React.useState<Ride | null>(null);
  const [routeInfo, setRouteInfo] = React.useState<RouteInfo | null>(null);

  React.useEffect(() => {
    if (!ride && !completedRide) {
      router.replace("/dashboard");
    }
  }, [ride, completedRide, router]);

  async function handleVerifyOtp() {
    if (!ride) return;
    const result = await verifyOtp.mutateAsync({ rideId: ride.id, otp });
    if (!result.success) {
      setOtpError("Incorrect OTP. Ask the rider to confirm.");
      return;
    }
    setOtpError(null);
  }

  async function handleEndRide() {
    if (!ride) return;
    const result = await endRide.mutateAsync(ride.id);
    if (result) setCompletedRide(result);
  }

  if (completedRide) {
    return <CompletedSummary ride={completedRide} onDone={() => router.push("/dashboard")} />;
  }

  if (!ride) return null;

  const isArriving = ride.status === "arriving";
  const isInProgress = ride.status === "in_progress";

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <PremiumMap
          className="h-60 w-full"
          pickup={ride.pickup.point}
          drop={ride.drop.point}
          liveMarker={liveGpsLocation ?? ride.driver?.location}
          showRoute
          onRouteInfo={setRouteInfo}
        />
        <div className="absolute left-4 top-4">
          <StatusPill status={ride.status} />
        </div>
      </div>

      <div className="-mt-6 flex flex-1 flex-col rounded-t-[1.75rem] bg-background px-5 pb-8 pt-6 shadow-elevation-3">
        {ride.rider && (
          <Card variant="elevated" className="animate-slide-up">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-primary/15">
                  <AvatarFallback className="text-base">{initials(ride.rider.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{ride.rider.name}</p>
                  <RatingStars value={ride.rider.rating} size={12} className="mt-0.5" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="icon" className="rounded-full" aria-label="Call rider">
                  <Phone size={16} />
                </Button>
                <Button variant="secondary" size="icon" className="rounded-full" aria-label="Message rider">
                  <MessageCircle size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card variant="default" className="mt-4 animate-slide-up">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                <span className="my-1 h-8 w-px border-l border-dashed border-border" />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
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
            {routeInfo && (
              <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Route size={13} /> {routeInfo.distanceKm} km
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 size={13} /> {routeInfo.durationMin} min
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {isArriving && (
          <Card variant="glass" className="mt-4 animate-scale-in">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Verify rider OTP</p>
                  <p className="text-xs text-muted-foreground">Ask the rider for their 4-digit code to start the trip</p>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <OtpInput
                  length={4}
                  value={otp}
                  onChange={(v) => {
                    setOtp(v);
                    setOtpError(null);
                  }}
                  disabled={verifyOtp.isPending}
                  autoFocus
                />
              </div>
              {otpError && <p className="mt-3 text-center text-sm font-medium text-destructive">{otpError}</p>}
              <Button
                size="lg"
                variant="glow"
                className="mt-5 w-full"
                disabled={otp.length < 4 || verifyOtp.isPending}
                onClick={handleVerifyOtp}
              >
                {verifyOtp.isPending ? "Verifying..." : "Start trip"}
              </Button>
            </CardContent>
          </Card>
        )}

        {isInProgress && (
          <div className="mt-4 flex flex-col gap-3">
            <Card variant="elevated" className="animate-scale-in">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Navigation2 size={16} className="text-primary" />
                  <span className="text-sm">Trip in progress &middot; fare so far</span>
                </div>
                <FareBadge amount={ride.fare.total} className="text-lg text-primary" />
              </CardContent>
            </Card>
            <Button size="lg" variant="destructive" disabled={endRide.isPending} onClick={handleEndRide}>
              {endRide.isPending ? "Ending trip..." : "End trip"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompletedSummary({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="grid h-20 w-20 animate-scale-in place-items-center rounded-full bg-success/15">
        <CheckCircle2 size={36} className="text-success" />
      </span>
      <div className="animate-fade-in">
        <h1 className="font-display text-2xl font-semibold text-foreground">Trip completed</h1>
        <p className="mt-1 text-sm text-muted-foreground">Nice work! Here&apos;s the fare breakdown.</p>
      </div>

      <div className="w-full animate-slide-up rounded-2xl border border-border bg-card p-5 text-left shadow-elevation-2">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <span className="text-sm font-medium text-muted-foreground">Total earned</span>
          <AnimatedCounter
            value={ride.fare.total}
            prefix="₹"
            className="font-display text-3xl font-bold text-primary"
          />
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Base fare</span>
            <span className="text-foreground">₹{ride.fare.base}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Distance</span>
            <span className="text-foreground">₹{ride.fare.distance}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Time</span>
            <span className="text-foreground">₹{ride.fare.time}</span>
          </div>
          {ride.fare.surge > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Surge</span>
              <span className="text-foreground">₹{ride.fare.surge}</span>
            </div>
          )}
          {ride.fare.promoDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-success">Rider promo discount</span>
              <span className="text-success">-₹{ride.fare.promoDiscount}</span>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Route size={13} /> {ride.distanceKm} km
          </span>
          <span className="flex items-center gap-1">
            <Clock3 size={13} /> {ride.durationMin} min
          </span>
          {ride.rating && <RatingStars value={ride.rating} size={13} />}
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
