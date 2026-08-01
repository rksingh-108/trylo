"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, Button, cn, FareBadge, RatingStars } from "@trylo/ui";
import { useRateRide, useRideDetail } from "@trylo/mock-data/hooks";
import { useBookingStore } from "@/lib/store";

const TIP_OPTIONS = [0, 20, 30, 50];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function RideCompletePage() {
  const router = useRouter();
  const { activeRideId, reset } = useBookingStore();
  const { data: ride } = useRideDetail(activeRideId);
  const rateRide = useRateRide();

  const [rating, setRating] = React.useState(5);
  const [tip, setTip] = React.useState(0);

  React.useEffect(() => {
    if (!activeRideId) router.replace("/home");
  }, [activeRideId, router]);

  async function handleSubmit() {
    if (!activeRideId) return;
    await rateRide.mutateAsync({ rideId: activeRideId, rating, tip });
    reset();
    router.push("/home");
  }

  function handleSkip() {
    reset();
    router.push("/home");
  }

  if (!activeRideId || !ride) return null;

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-success/15">
          <CheckCircle2 size={28} className="text-success" />
        </span>
        <h1 className="font-display text-xl font-semibold text-foreground">Ride complete</h1>
        <p className="text-sm text-muted-foreground">Hope you had a great trip!</p>
      </div>

      {ride.driver && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarFallback>{initials(ride.driver.name)}</AvatarFallback>
          </Avatar>
          <p className="font-medium text-foreground">{ride.driver.name}</p>
          <RatingStars value={rating} interactive size={28} onChange={setRating} />
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Add a tip</p>
        <div className="grid grid-cols-4 gap-2">
          {TIP_OPTIONS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setTip(amount)}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium transition-colors",
                tip === amount ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"
              )}
            >
              {amount === 0 ? "No tip" : `₹${amount}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
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
        {tip > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Tip</span>
            <span className="text-foreground">₹{tip}</span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="font-display text-base font-semibold text-foreground">Total paid</span>
          <FareBadge amount={ride.fare.total + tip} className="text-lg" />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button size="lg" disabled={rateRide.isPending} onClick={handleSubmit}>
          {rateRide.isPending ? "Submitting..." : "Submit & go home"}
        </Button>
        <button type="button" onClick={handleSkip} className="text-center text-sm font-medium text-muted-foreground">
          Skip
        </button>
      </div>
    </div>
  );
}
