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
  CancelRideSheet,
  CUSTOMER_CANCEL_REASONS,
  FareBadge,
  PageTransition,
  PremiumMap,
  RatingStars,
  RideChatSheet,
  Skeleton,
  SosConfirmSheet,
  StatusPill,
  toast,
  WaitingTimer,
  type RouteInfo,
} from "@trylo/ui";
import { getRideMessages } from "@trylo/mock-data";
import {
  useActiveRide,
  useCancelRide,
  useDriverLiveLocation,
  useLiveNotifications,
  useRideChat,
  useRideStatus,
  useTriggerSos,
} from "@trylo/mock-data/hooks";
import { useBookingStore } from "@/lib/store";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const panelContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const panelItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 22, stiffness: 220 } },
};

function RideLoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <Skeleton className="h-72 w-full rounded-none" />
      <div className="flex-1 px-5 pb-8 pt-4">
        <div className="flex justify-end">
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-elevation-2">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded" />
        </div>
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function LiveRidePage() {
  const router = useRouter();
  const { activeRideId, setActiveRideId, reset } = useBookingStore();
  // A hard refresh wipes the in-memory booking store, so `activeRideId` may be
  // unknown even though the rider genuinely has a ride in flight server-side.
  // Rehydrate it from the server before giving up and bouncing to /home — this
  // is what lets the waiting timer (anchored to the server's `arrivedAt`) keep
  // counting correctly across a refresh instead of losing the ride entirely.
  const { data: rehydratedRide, isFetched: rehydrationFetched } = useActiveRide(!activeRideId);
  const { data: ride } = useRideStatus(activeRideId);
  const liveDriverLocation = useDriverLiveLocation(activeRideId);
  const cancelRide = useCancelRide();
  const triggerSos = useTriggerSos();
  const { messages: chatMessages, send: sendChatMessage } = useRideChat(activeRideId, getRideMessages);
  const [sosOpen, setSosOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = React.useState(false);
  const [routeInfo, setRouteInfo] = React.useState<RouteInfo | null>(null);
  const cancelHandledRef = React.useRef(false);
  const [seenMessageCount, setSeenMessageCount] = React.useState(0);
  const hasUnreadMessages = chatMessages.length > seenMessageCount;

  React.useEffect(() => {
    if (chatOpen) setSeenMessageCount(chatMessages.length);
  }, [chatOpen, chatMessages.length]);

  useLiveNotifications(activeRideId, "customer", (notification) => {
    toast.info(notification.title, { description: notification.body });
  });

  React.useEffect(() => {
    if (activeRideId) return;
    if (!rehydrationFetched) return;
    if (rehydratedRide) setActiveRideId(rehydratedRide.id);
    else router.replace("/home");
  }, [activeRideId, rehydrationFetched, rehydratedRide, router, setActiveRideId]);

  React.useEffect(() => {
    if (ride?.status === "completed") {
      router.push("/ride/complete");
    }
  }, [ride?.status, router]);

  // Handles a cancellation from either side — driven purely by the ride's own
  // status, so it fires identically whether the rider just cancelled it
  // themselves (the mutation seeds this same cache) or the driver cancelled
  // it while this screen was open (pushed in live via the ride:updated socket).
  React.useEffect(() => {
    if (ride?.status !== "cancelled" || cancelHandledRef.current) return;
    cancelHandledRef.current = true;
    if (ride.cancelledBy === "driver") {
      toast.error("Driver cancelled the ride", { description: ride.cancelReason });
    } else {
      toast.success("Ride cancelled");
    }
    reset();
    router.replace("/home");
  }, [ride?.status, ride?.cancelledBy, ride?.cancelReason, reset, router]);

  if (!activeRideId) return <RideLoadingSkeleton />;
  if (!ride) return <RideLoadingSkeleton />;

  const driver = ride.driver;
  const isArrived = ride.status === "arrived";
  const showOtp = Boolean(driver) && ride.status !== "in_progress";
  const followLive = ride.status === "arriving" || ride.status === "arrived" || ride.status === "in_progress";
  const canCancel = ride.status === "requested" || ride.status === "matched" || ride.status === "arriving";

  async function handleCancelConfirm(reason: string) {
    if (!activeRideId) return;
    await cancelRide.mutateAsync({ rideId: activeRideId, reason });
    setCancelSheetOpen(false);
  }

  async function handleSosConfirm() {
    if (!activeRideId) return;
    await triggerSos.mutateAsync({ rideId: activeRideId });
    setSosOpen(false);
    toast.success("Emergency alert sent to TRYLO support");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <PremiumMap
          className="h-72 w-full"
          pickup={ride.pickup.point}
          drop={ride.drop.point}
          liveMarker={liveDriverLocation ?? driver?.location}
          showRoute
          followLive={followLive}
          liveMarkerWaiting={isArrived}
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
        <motion.div variants={panelContainer} initial="hidden" animate="show">
        <motion.div variants={panelItem} className="flex items-center justify-end">
          <FareBadge amount={ride.fare.total} />
        </motion.div>

        {driver && (
          <motion.div
            variants={panelItem}
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
              {isArrived ? (
                <WaitingTimer anchorIso={ride.arrivedAt} label="Waiting for you…" className="shrink-0" />
              ) : (
                typeof driver.etaMinutes === "number" && (
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xl font-semibold text-foreground">{driver.etaMinutes}</p>
                    <p className="text-[11px] text-muted-foreground">min ETA</p>
                  </div>
                )
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
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Calling is not available yet"
                  title="Calling is not available yet"
                  disabled
                >
                  <Phone size={15} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative h-9 w-9"
                  aria-label="Message driver"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageCircle size={15} />
                  {hasUnreadMessages && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {showOtp && (
          <motion.div
            variants={panelItem}
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

        <motion.div variants={panelItem} className="mt-4 rounded-xl border border-border bg-card p-4">
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
        </motion.div>

        {canCancel && (
          <motion.div variants={panelItem}>
            <Button
              variant="outline"
              size="lg"
              className="mt-4 w-full text-destructive"
              onClick={() => setCancelSheetOpen(true)}
            >
              Cancel ride
            </Button>
          </motion.div>
        )}

        <motion.div variants={panelItem}>
          <Button variant="destructive" size="lg" className="mt-4 w-full" onClick={() => setSosOpen(true)}>
            <AlertTriangle size={18} />
            SOS
          </Button>
        </motion.div>
        </motion.div>
      </PageTransition>

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
        currentRole="customer"
        otherPartyLabel={driver?.name ?? "Driver"}
        onSend={sendChatMessage}
      />

      <CancelRideSheet
        open={cancelSheetOpen}
        onOpenChange={setCancelSheetOpen}
        reasons={CUSTOMER_CANCEL_REASONS}
        onConfirm={handleCancelConfirm}
        isPending={cancelRide.isPending}
      />
    </div>
  );
}
