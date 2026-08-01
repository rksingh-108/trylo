"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { Avatar, AvatarFallback, Button, FareBadge, MapPlaceholder, OtpInput, RatingStars } from "@trylo/ui";
import { useActiveDriverRide, useEndRide, useVerifyRiderOtp } from "@trylo/mock-data/hooks";
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

  const [otp, setOtp] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [completedRide, setCompletedRide] = React.useState<Ride | null>(null);

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
      <MapPlaceholder
        className="h-56 w-full"
        pickup={{ x: 50, y: 28 }}
        drop={{ x: 50, y: 72 }}
        liveMarker={isArriving ? { x: 28, y: 14 } : { x: 50, y: 50 }}
        showRoute
      />

      <div className="flex-1 px-5 pb-8 pt-4">
        {ride.rider && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback>{initials(ride.rider.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">{ride.rider.name}</p>
                <RatingStars value={ride.rider.rating} size={12} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Call rider">
                <Phone size={16} />
              </Button>
              <Button variant="outline" size="icon" aria-label="Message rider">
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

        {isArriving && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Enter rider's OTP to start the trip</p>
            <div className="mt-3 flex justify-center">
              <OtpInput
                length={4}
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  setOtpError(null);
                }}
                disabled={verifyOtp.isPending}
              />
            </div>
            {otpError && <p className="mt-2 text-center text-sm text-destructive">{otpError}</p>}
            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={otp.length < 4 || verifyOtp.isPending}
              onClick={handleVerifyOtp}
            >
              {verifyOtp.isPending ? "Verifying..." : "Start trip"}
            </Button>
          </div>
        )}

        {isInProgress && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <span className="text-sm text-muted-foreground">Trip fare</span>
              <FareBadge amount={ride.fare.total} />
            </div>
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
      <span className="grid h-16 w-16 place-items-center rounded-full bg-success/15">
        <CheckCircle2 size={32} className="text-success" />
      </span>
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground">Trip completed</h1>
        <p className="mt-1 text-sm text-muted-foreground">Nice work! Here's the fare breakdown.</p>
      </div>

      <div className="w-full rounded-xl border border-border bg-card p-4 text-left">
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
            <span className="text-success">Rider promo discount</span>
            <span className="text-success">-₹{ride.fare.promoDiscount}</span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="font-display text-base font-semibold text-foreground">Total earned</span>
          <FareBadge amount={ride.fare.total} className="text-lg" />
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
