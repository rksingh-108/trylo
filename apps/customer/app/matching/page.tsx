"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Car, MessageCircle, Phone, X } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  CancelRideSheet,
  CUSTOMER_CANCEL_REASONS,
  FareBadge,
  RatingStars,
  RideChatSheet,
} from "@trylo/ui";
import { getRideMessages } from "@trylo/mock-data";
import { useActiveRide, useCancelRide, useRideChat, useRideStatus } from "@trylo/mock-data/hooks";
import { useBookingStore } from "@/lib/store";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const matchedContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const matchedItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 24, stiffness: 260 } },
};

export default function MatchingPage() {
  const router = useRouter();
  const { activeRideId, setActiveRideId, reset } = useBookingStore();

  // `activeRideId` lives only in an in-memory store, so a page refresh while
  // still "Finding your driver" would otherwise lose it and bounce straight to
  // /home even though the ride is still alive server-side - rehydrate from the
  // server first (same pattern as apps/customer/app/ride/page.tsx) and only
  // give up on /home once we've actually confirmed there's nothing to resume.
  const { data: rehydratedRide, isFetched: rehydrationFetched } = useActiveRide(!activeRideId);

  React.useEffect(() => {
    if (activeRideId) return;
    if (!rehydrationFetched) return;
    if (rehydratedRide) setActiveRideId(rehydratedRide.id);
    else router.replace("/home");
  }, [activeRideId, rehydrationFetched, rehydratedRide, router, setActiveRideId]);

  const { data: ride } = useRideStatus(activeRideId);
  const cancelRide = useCancelRide();
  const { messages: chatMessages, send: sendChatMessage } = useRideChat(activeRideId, getRideMessages);
  const [cancelSheetOpen, setCancelSheetOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);

  async function handleCancel(reason: string) {
    if (!activeRideId) return;
    await cancelRide.mutateAsync({ rideId: activeRideId, reason });
    setCancelSheetOpen(false);
    reset();
    router.replace("/home");
  }

  if (!activeRideId) return null;

  const isSearching = !ride || ride.status === "requested";
  const driver = ride?.driver;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AnimatePresence>
        {isSearching ? (
          <motion.div
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.25 } }}
            transition={{ duration: 0.3 }}
            className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center"
          >
            <div className="relative flex h-48 w-48 items-center justify-center">
              {/* concentric pulse rings */}
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/15" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/15 [animation-delay:0.6s]" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/15 [animation-delay:1.2s]" />

              {/* rotating scan sweep */}
              <motion.span
                aria-hidden
                className="absolute inset-2 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0%, hsl(var(--primary)/0.55) 18%, transparent 42%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              />

              <span className="absolute inset-6 rounded-full bg-background shadow-elevation-2" />

              <motion.span
                className="relative grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Car size={26} />
              </motion.span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h1 className="font-display text-xl font-semibold text-foreground">Finding your driver</h1>
              <p className="mt-1 text-sm text-muted-foreground">Hang tight, matching you with nearby drivers…</p>
            </motion.div>
            <Button variant="outline" onClick={() => setCancelSheetOpen(true)} disabled={cancelRide.isPending}>
              <X size={16} />
              Cancel ride
            </Button>
          </motion.div>
        ) : driver ? (
          <motion.div
            key="matched"
            variants={matchedContainer}
            initial="hidden"
            animate="show"
            className="mt-auto flex flex-col gap-5 rounded-t-[1.75rem] border-t border-border bg-card px-6 pb-8 pt-6 shadow-elevation-4"
          >
            <motion.div variants={matchedItem} className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <p className="text-sm font-medium text-success">Driver on the way</p>
            </motion.div>

            <motion.div variants={matchedItem} className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 14, stiffness: 260, delay: 0.1 }}
                className="relative shrink-0"
              >
                <span className="absolute -inset-1.5 rounded-full bg-primary/25 blur-md" />
                <Avatar className="relative h-16 w-16 border-2 border-background shadow-elevation-2">
                  {driver.avatarUrl && <AvatarImage src={driver.avatarUrl} alt={driver.name} />}
                  <AvatarFallback>{initials(driver.name)}</AvatarFallback>
                </Avatar>
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold text-foreground">{driver.name}</p>
                <RatingStars value={driver.rating} size={14} />
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-2xl font-semibold text-foreground">{driver.etaMinutes}</p>
                <p className="text-xs text-muted-foreground">min away</p>
              </div>
            </motion.div>

            <motion.div
              variants={matchedItem}
              className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
            >
              <span className="font-mono text-sm font-medium tracking-widest text-foreground">
                {driver.vehicle.registrationNumber}
              </span>
              {ride && <FareBadge amount={ride.fare.total} />}
            </motion.div>

            <motion.div variants={matchedItem} className="flex gap-3">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="Calling is not available yet"
                title="Calling is not available yet"
                disabled
              >
                <Phone size={18} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="Message driver"
                onClick={() => setChatOpen(true)}
              >
                <MessageCircle size={18} />
              </Button>
              <Button variant="glow" size="lg" className="flex-1" onClick={() => router.push("/ride")}>
                Track ride
              </Button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CancelRideSheet
        open={cancelSheetOpen}
        onOpenChange={setCancelSheetOpen}
        reasons={CUSTOMER_CANCEL_REASONS}
        onConfirm={handleCancel}
        isPending={cancelRide.isPending}
      />

      <RideChatSheet
        open={chatOpen}
        onOpenChange={setChatOpen}
        messages={chatMessages}
        currentRole="customer"
        otherPartyLabel={driver?.name ?? "Driver"}
        onSend={sendChatMessage}
      />
    </div>
  );
}
