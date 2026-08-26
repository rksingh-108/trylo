"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, TrendingUp, User, Wallet, Zap } from "lucide-react";
import { AnimatedCounter, Card, PremiumMap, RatingStars, Switch, toast } from "@trylo/ui";
import {
  useActiveDriverRide,
  useDashboardSummary,
  useIncomingRequest,
  useReportLiveLocation,
  useSetOnlineStatus,
} from "@trylo/mock-data/hooks";
import { IncomingRequestOverlay } from "@/components/incoming-request-overlay";

function formatOnlineDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: summary } = useDashboardSummary();
  const setOnlineStatus = useSetOnlineStatus();
  const isOnline = summary?.isOnline ?? false;

  // The driver's active ride is looked up purely by driver identity server-side
  // (no client-stored ride id needed), so a fresh app launch mid-ride (browser/PWA
  // reload after re-authenticating, phone backgrounding, etc.) would otherwise
  // strand the driver here on the plain online/offline dashboard instead of their
  // actual in-flight ride.
  const { data: activeRide } = useActiveDriverRide();
  React.useEffect(() => {
    if (activeRide) router.replace("/ride");
  }, [activeRide, router]);

  const { data: offer } = useIncomingRequest(isOnline);

  function handleToggle(next: boolean) {
    setOnlineStatus.mutate(next, {
      onError: () => {
        toast.error(next ? "Couldn't go online" : "Couldn't go offline", {
          description: "Please try again in a moment.",
        });
      },
    });
  }

  const liveGpsLocation = useReportLiveLocation(isOnline);
  const driverLocation = liveGpsLocation ?? summary?.driver?.location;

  return (
    <div className="flex flex-1 flex-col pb-6">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="animate-fade-in">
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <p className="font-display text-lg font-semibold text-foreground">{summary?.driver.name || "Driver"}</p>
        </div>
        <Link
          href="/profile"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-elevation-1 transition-transform active:scale-95"
          aria-label="Profile"
        >
          <User size={18} className="text-foreground" />
        </Link>
      </div>

      {/* Hero online/offline card — the most important control in the app */}
      <div className="mt-4 px-5">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className={`relative overflow-hidden rounded-2xl border p-4 transition-colors duration-500 ${
            isOnline ? "border-primary/30 bg-primary/5 shadow-glow-sm" : "border-border bg-card shadow-elevation-1"
          }`}
        >
          {isOnline && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full">
                {isOnline && <span className="absolute inset-0 rounded-full bg-primary/40 animate-pulse-ring" />}
                <span
                  className={`relative grid h-12 w-12 place-items-center rounded-full transition-colors duration-500 ${
                    isOnline ? "bg-primary/15" : "bg-muted"
                  }`}
                >
                  <Zap
                    size={20}
                    className={isOnline ? "text-primary" : "text-muted-foreground"}
                    fill={isOnline ? "currentColor" : "none"}
                  />
                </span>
              </span>
              <div>
                <p className="font-display text-base font-semibold text-foreground">
                  {isOnline ? "You're online" : "You're offline"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isOnline ? "Looking for ride requests nearby" : "Go online to start receiving requests"}
                </p>
              </div>
            </div>
            <Switch
              checked={isOnline}
              onCheckedChange={handleToggle}
              disabled={setOnlineStatus.isPending}
              aria-label="Toggle online status"
            />
          </div>
        </motion.div>
      </div>

      {/* Live map preview */}
      <div className="mt-4 px-5">
        <div
          className="animate-slide-up overflow-hidden rounded-2xl border border-border shadow-elevation-2"
          style={{ animationDelay: "60ms" }}
        >
          <PremiumMap
            className="h-52 w-full"
            liveMarker={driverLocation}
            liveMarkerHeading={liveGpsLocation?.heading}
            center={driverLocation}
            zoom={15}
            showCurrentLocationButton
          >
            <div className="glass-strong absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-elevation-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-primary animate-pulse" : "bg-muted-foreground"}`}
              />
              {isOnline ? "Live location" : "Location paused"}
            </div>
          </PremiumMap>
        </div>
      </div>

      {/* Today's stats */}
      <div className="mt-5 px-5">
        <p className="mb-2 text-sm font-medium text-foreground">Today</p>
        <div className="grid grid-cols-3 gap-3">
          <Card
            variant="elevated"
            className="animate-slide-up flex flex-col items-center gap-1.5 p-4 text-center"
            style={{ animationDelay: "100ms" }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10">
              <Wallet size={16} className="text-primary" />
            </span>
            <AnimatedCounter
              value={summary?.todayEarnings ?? 0}
              prefix="₹"
              className="font-display text-lg font-semibold text-foreground"
            />
            <p className="text-[11px] text-muted-foreground">Earnings</p>
          </Card>
          <Card
            variant="elevated"
            className="animate-slide-up flex flex-col items-center gap-1.5 p-4 text-center"
            style={{ animationDelay: "150ms" }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/10">
              <TrendingUp size={16} className="text-amber-500" />
            </span>
            <AnimatedCounter
              value={summary?.todayRides ?? 0}
              className="font-display text-lg font-semibold text-foreground"
            />
            <p className="text-[11px] text-muted-foreground">Rides</p>
          </Card>
          <Card
            variant="elevated"
            className="animate-slide-up flex flex-col items-center gap-1.5 p-4 text-center"
            style={{ animationDelay: "200ms" }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-500/10">
              <Clock3 size={16} className="text-teal-600" />
            </span>
            <p className="font-display text-lg font-semibold text-foreground">
              {formatOnlineDuration(summary?.onlineMinutes ?? 0)}
            </p>
            <p className="text-[11px] text-muted-foreground">Online</p>
          </Card>
        </div>
      </div>

      {summary?.driver && (
        <div className="mt-4 flex-1 px-5">
          <Card
            variant="default"
            className="animate-slide-up flex items-center justify-between p-4"
            style={{ animationDelay: "250ms" }}
          >
            <div>
              <p className="text-sm font-medium text-foreground">Your rating</p>
              <div className="mt-1.5 flex items-center gap-2">
                <RatingStars value={summary.driver.rating} size={16} />
                <span className="font-mono text-sm font-semibold text-foreground">
                  {summary.driver.rating.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-semibold text-foreground">{summary.driver.totalRides}</p>
              <p className="text-xs text-muted-foreground">total rides</p>
            </div>
          </Card>
        </div>
      )}

      <AnimatePresence>{offer && <IncomingRequestOverlay key={offer.ride.id} offer={offer} />}</AnimatePresence>
    </div>
  );
}
