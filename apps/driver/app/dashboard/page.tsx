"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { User, Zap } from "lucide-react";
import { AnimatedCounter, MapPlaceholder, RatingStars, Switch } from "@trylo/ui";
import { useDashboardSummary, useIncomingRequest, useSetOnlineStatus } from "@trylo/mock-data/hooks";
import { IncomingRequestOverlay } from "@/components/incoming-request-overlay";

function formatOnlineDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

export default function DashboardPage() {
  const { data: summary } = useDashboardSummary();
  const setOnlineStatus = useSetOnlineStatus();
  const isOnline = summary?.isOnline ?? false;

  const { data: offer } = useIncomingRequest(isOnline);

  function handleToggle(next: boolean) {
    setOnlineStatus.mutate(next);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <p className="font-display text-lg font-semibold text-foreground">{summary?.driver.name || "Driver"}</p>
        </div>
        <Link
          href="/profile"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm"
          aria-label="Profile"
        >
          <User size={18} className="text-foreground" />
        </Link>
      </div>

      <div className="mt-4 px-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 place-items-center rounded-full ${isOnline ? "bg-primary/15" : "bg-muted"}`}
            >
              <Zap size={18} className={isOnline ? "text-primary" : "text-muted-foreground"} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                {isOnline ? "You're online" : "You're offline"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOnline ? "Looking for ride requests nearby" : "Go online to start receiving requests"}
              </p>
            </div>
          </div>
          <Switch checked={isOnline} onCheckedChange={handleToggle} disabled={setOnlineStatus.isPending} />
        </div>
      </div>

      <div className="mt-4 px-5">
        <MapPlaceholder className="h-48 w-full rounded-xl" liveMarker={{ x: 50, y: 45 }} />
      </div>

      <div className="mt-4 flex-1 px-5 pb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Today</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <AnimatedCounter
                value={summary?.todayEarnings ?? 0}
                prefix="₹"
                className="font-display text-xl font-semibold text-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">Earnings</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-foreground">{summary?.todayRides ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">Rides</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-foreground">
                {formatOnlineDuration(summary?.onlineMinutes ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Online</p>
            </div>
          </div>
        </div>

        {summary?.driver && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Your rating</p>
              <div className="mt-1">
                <RatingStars value={summary.driver.rating} size={16} />
              </div>
            </div>
            <p className="font-mono text-sm text-muted-foreground">{summary.driver.totalRides} rides</p>
          </div>
        )}
      </div>

      <AnimatePresence>{offer && <IncomingRequestOverlay key={offer.ride.id} offer={offer} />}</AnimatePresence>
    </div>
  );
}
