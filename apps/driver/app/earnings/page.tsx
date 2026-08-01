"use client";

import * as React from "react";
import { Banknote } from "lucide-react";
import { FareBadge, Tabs, TabsContent, TabsList, TabsTrigger } from "@trylo/ui";
import { useDriverEarnings, usePayoutHistory } from "@trylo/mock-data/hooks";
import type { EarningsSummary } from "@trylo/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  processed: "Processed",
  pending: "Pending",
  failed: "Failed",
};

export default function EarningsPage() {
  const [period, setPeriod] = React.useState<EarningsSummary["period"]>("daily");
  const { data: earnings } = useDriverEarnings(period);
  const { data: payouts } = usePayoutHistory();

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">Earnings</h1>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as EarningsSummary["period"])} className="mt-5">
        <TabsList className="w-full">
          <TabsTrigger value="daily" className="flex-1">
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">
            Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1">
            Monthly
          </TabsTrigger>
        </TabsList>

        <TabsContent value={period}>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total earnings</p>
            <p className="mt-1 font-display text-3xl font-semibold text-foreground">₹{earnings?.totalEarnings ?? 0}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-display text-lg font-semibold text-foreground">{earnings?.totalRides ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Rides</p>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-foreground">{earnings?.totalDistanceKm ?? 0} km</p>
                <p className="mt-1 text-xs text-muted-foreground">Distance</p>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-foreground">{earnings?.onlineHours ?? 0}h</p>
                <p className="mt-1 text-xs text-muted-foreground">Online</p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-foreground">Ride-by-ride</p>
            {earnings?.rides.length === 0 && (
              <p className="text-sm text-muted-foreground">No rides in this period yet.</p>
            )}
            {earnings && earnings.rides.length > 0 && (
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                {earnings.rides.map((r) => (
                  <div key={r.rideId} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatDate(r.completedAt)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.distanceKm} km</p>
                    </div>
                    <FareBadge amount={r.fare} className="text-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Payout history</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {payouts?.map((payout) => (
            <div key={payout.id} className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                <Banknote size={18} className="text-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Bank •••• {payout.bankAccountLast4}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(payout.initiatedAt)} · {PAYOUT_STATUS_LABEL[payout.status]}
                </p>
              </div>
              <FareBadge amount={payout.amount} className="text-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
