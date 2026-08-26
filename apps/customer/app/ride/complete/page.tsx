"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Button, cn, FareBadge, RatingStars, toast } from "@trylo/ui";
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
    toast.success("Thanks for your feedback!");
    reset();
    router.push("/home");
  }

  function handleSkip() {
    reset();
    router.push("/home");
  }

  if (!activeRideId || !ride) return null;

  const paymentFailed = ride.paymentStatus === "failed";

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative grid h-20 w-20 place-items-center">
          <motion.span
            initial={{ scale: 0.4, opacity: 0.6 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
            className={cn("absolute inset-0 rounded-full", paymentFailed ? "bg-destructive/25" : "bg-success/30")}
          />
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
            className={cn(
              "grid h-16 w-16 place-items-center rounded-full",
              paymentFailed ? "bg-destructive/15" : "bg-success/15"
            )}
          >
            <motion.span
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.25 }}
              className="grid place-items-center"
            >
              {paymentFailed ? (
                <AlertTriangle size={30} className="text-destructive" />
              ) : (
                <CheckCircle2 size={30} className="text-success" />
              )}
            </motion.span>
          </motion.span>
        </div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <h1 className="font-display text-xl font-semibold text-foreground">
            {paymentFailed ? "Payment failed" : "Ride complete"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {paymentFailed
              ? "Your wallet balance was too low to cover this ride's fare."
              : "Hope you had a great trip!"}
          </p>
        </motion.div>
      </div>

      {paymentFailed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="text-sm text-foreground">
            This trip is unpaid. Add money to your wallet to settle the balance — your account will show this as
            outstanding until then.
          </p>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => router.push("/wallet")}>
            Go to wallet
          </Button>
        </motion.div>
      )}

      {ride.driver && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="mt-6 flex flex-col items-center gap-3"
        >
          <Avatar className="h-14 w-14 border-2 border-background shadow-elevation-2">
            {ride.driver.avatarUrl && <AvatarImage src={ride.driver.avatarUrl} alt={ride.driver.name} />}
            <AvatarFallback>{initials(ride.driver.name)}</AvatarFallback>
          </Avatar>
          <p className="font-medium text-foreground">{ride.driver.name}</p>
          <p className="text-xs text-muted-foreground">
            How was your ride with {ride.driver.name.split(" ")[0]}?
          </p>
          <RatingStars value={rating} interactive size={32} onChange={setRating} className="mt-1 gap-2" />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44 }}
        className="mt-6"
      >
        <p className="mb-2 text-sm font-medium text-foreground">Add a tip</p>
        <div className="grid grid-cols-4 gap-2">
          {TIP_OPTIONS.map((amount) => {
            const selected = tip === amount;
            return (
              <motion.button
                key={amount}
                type="button"
                onClick={() => setTip(amount)}
                whileTap={{ scale: 0.94 }}
                animate={selected ? { scale: 1.05 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary shadow-glow-sm"
                    : "border-border bg-card text-foreground hover:bg-muted/60"
                )}
              >
                {amount === 0 ? "No tip" : `₹${amount}`}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-elevation-1"
      >
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
            <span className="text-muted-foreground">Tip (not yet supported — not charged)</span>
            <span className="text-foreground">₹{tip}</span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span
            className={cn(
              "font-display text-base font-semibold",
              paymentFailed ? "text-destructive" : "text-foreground"
            )}
          >
            {paymentFailed ? "Amount due" : "Total paid"}
          </span>
          {/* Only the fare is ever actually charged — tipping isn't wired up to any
              payment path yet, so it must never be folded into what "paid" claims. */}
          <FareBadge amount={ride.fare.total} className={cn("text-lg", paymentFailed && "text-destructive")} />
        </div>
      </motion.div>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button size="lg" variant="glow" disabled={rateRide.isPending} onClick={handleSubmit}>
          {rateRide.isPending ? "Submitting..." : "Submit & go home"}
        </Button>
        <button type="button" onClick={handleSkip} className="text-center text-sm font-medium text-muted-foreground">
          Skip
        </button>
      </div>
    </div>
  );
}
