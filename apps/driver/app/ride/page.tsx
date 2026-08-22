"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, MessageCircle, Navigation2, Phone, Route, ShieldCheck } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AnimatedCounter,
  Button,
  CancelRideSheet,
  Card,
  CardContent,
  DRIVER_CANCEL_REASONS,
  FareBadge,
  OtpInput,
  PremiumMap,
  RatingStars,
  RideChatSheet,
  Skeleton,
  SosConfirmSheet,
  StatusPill,
  toast,
  WaitingTimer,
} from "@trylo/ui";
import type { RouteInfo } from "@trylo/ui";
import { getDriverRideMessages } from "@trylo/mock-data";
import {
  useActiveDriverRide,
  useCancelDriverRide,
  useEndRide,
  useLiveNotifications,
  useReportLiveLocation,
  useRideChat,
  useTriggerDriverSos,
  useVerifyRiderOtp,
} from "@trylo/mock-data/hooks";
import type { Ride } from "@trylo/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RideLoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <Skeleton className="h-60 w-full rounded-none" />
      <div className="-mt-6 flex flex-1 flex-col rounded-t-[1.75rem] bg-background px-5 pb-8 pt-6 shadow-elevation-3">
        <Card variant="elevated">
          <CardContent className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </div>
          </CardContent>
        </Card>
        <Card variant="default" className="mt-4">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ActiveRidePage() {
  const router = useRouter();
  const { data: ride } = useActiveDriverRide();
  const verifyOtp = useVerifyRiderOtp();
  const endRide = useEndRide();
  const cancelDriverRide = useCancelDriverRide();
  const liveGpsLocation = useReportLiveLocation(Boolean(ride));
  const triggerSos = useTriggerDriverSos();
  const { messages: chatMessages, send: sendChatMessage } = useRideChat(ride?.id ?? null, getDriverRideMessages);

  const [otp, setOtp] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [completedRide, setCompletedRide] = React.useState<Ride | null>(null);
  const [routeInfo, setRouteInfo] = React.useState<RouteInfo | null>(null);
  const [cancelSheetOpen, setCancelSheetOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [sosOpen, setSosOpen] = React.useState(false);
  const cancelHandledRef = React.useRef(false);

  useLiveNotifications(ride?.id ?? null, "driver", (notification) => {
    toast.info(notification.title, { description: notification.body });
  });

  React.useEffect(() => {
    if (!ride && !completedRide) {
      router.replace("/dashboard");
    }
  }, [ride, completedRide, router]);

  // Fires only when the *rider* cancels while this screen is open (pushed live
  // via the ride:updated socket) — a driver-initiated cancel never puts a
  // "cancelled" ride object into this cache, it clears it to null instead, so
  // this can't double-fire for the driver's own action.
  React.useEffect(() => {
    if (ride?.status !== "cancelled" || cancelHandledRef.current) return;
    cancelHandledRef.current = true;
    if (ride.cancelledBy !== "driver") {
      toast.error("Rider cancelled the ride", { description: ride.cancelReason });
    }
    router.replace("/dashboard");
  }, [ride?.status, ride?.cancelledBy, ride?.cancelReason, router]);

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

  async function handleSosConfirm() {
    if (!ride) return;
    await triggerSos.mutateAsync({ rideId: ride.id });
    setSosOpen(false);
    toast.success("Emergency alert sent to TRYLO support");
  }

  async function handleCancelConfirm(reason: string) {
    if (!ride) return;
    await cancelDriverRide.mutateAsync({ rideId: ride.id, reason });
    setCancelSheetOpen(false);
    toast.success("Ride cancelled");
    router.replace("/dashboard");
  }

  if (completedRide) {
    return <CompletedSummary ride={completedRide} onDone={() => router.push("/dashboard")} />;
  }

  if (!ride) return <RideLoadingSkeleton />;

  const isArriving = ride.status === "arriving";
  const isArrived = ride.status === "arrived";
  const isInProgress = ride.status === "in_progress";
  const canCancel = isArriving || isArrived;

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <PremiumMap
          className="h-60 w-full"
          pickup={ride.pickup.point}
          drop={ride.drop.point}
          liveMarker={liveGpsLocation ?? ride.driver?.location}
          showRoute
          followLive={isArriving || isArrived || isInProgress}
          liveMarkerWaiting={isArrived}
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
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  aria-label="Message rider"
                  onClick={() => setChatOpen(true)}
                >
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

        {isArrived && (
          <Card variant="glass" className="mt-4 animate-scale-in">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <Clock3 size={18} />
                </span>
                <p className="text-sm font-semibold text-foreground">Waiting Time</p>
              </div>
              <WaitingTimer anchorIso={ride.arrivedAt} label="" />
            </CardContent>
          </Card>
        )}

        {isArrived && (
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

        {canCancel && (
          <Button
            variant="outline"
            size="lg"
            className="mt-4 w-full text-destructive"
            onClick={() => setCancelSheetOpen(true)}
          >
            Cancel ride
          </Button>
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

        <Button variant="destructive" size="lg" className="mt-4 w-full" onClick={() => setSosOpen(true)}>
          <AlertTriangle size={18} />
          SOS
        </Button>
      </div>

      <SosConfirmSheet
        open={sosOpen}
        onOpenChange={setSosOpen}
        onConfirm={handleSosConfirm}
        isPending={triggerSos.isPending}
      />

      <RideChatSheet
        open={chatOpen}
        onOpenChange={setChatOpen}
        messages={chatMessages}
        currentRole="driver"
        otherPartyLabel={ride.rider?.name ?? "Rider"}
        onSend={sendChatMessage}
      />

      <CancelRideSheet
        open={cancelSheetOpen}
        onOpenChange={setCancelSheetOpen}
        reasons={DRIVER_CANCEL_REASONS}
        onConfirm={handleCancelConfirm}
        isPending={cancelDriverRide.isPending}
      />
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
