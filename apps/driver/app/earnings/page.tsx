"use client";

import * as React from "react";
import { Banknote, Clock4, MapPinned, TrendingUp, Wallet } from "lucide-react";
import {
  AnimatedCounter,
  Badge,
  Card,
  CardContent,
  FareBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@trylo/ui";
import { useDriverEarnings, usePayoutHistory } from "@trylo/mock-data/hooks";
import type { EarningsSummary, PayoutRecord } from "@trylo/types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const PAYOUT_STATUS_LABEL: Record<PayoutRecord["status"], string> = {
  processed: "Processed",
  pending: "Pending",
  failed: "Failed",
};

const PAYOUT_STATUS_VARIANT: Record<PayoutRecord["status"], "success" | "warning" | "destructive"> = {
  processed: "success",
  pending: "warning",
  failed: "destructive",
};

function EarningsChart({ rides }: { rides: EarningsSummary["rides"] }) {
  const data = rides.map((r) => ({
    label: formatDate(r.completedAt),
    fare: r.fare,
  }));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
              color: "hsl(var(--foreground))",
            }}
            formatter={(value: number) => [`₹${value}`, "Fare"]}
          />
          <Bar dataKey="fare" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function EarningsPage() {
  const [period, setPeriod] = React.useState<EarningsSummary["period"]>("daily");
  const { data: earnings } = useDriverEarnings(period);
  const { data: payouts } = usePayoutHistory();

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">Earnings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Track what you&apos;ve earned, ride by ride.</p>

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
          <Card variant="elevated" className="animate-slide-up overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 via-transparent to-transparent">
              <CardContent className="p-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet size={14} />
                  <p className="text-sm">Total earnings</p>
                </div>
                <AnimatedCounter
                  value={earnings?.totalEarnings ?? 0}
                  prefix="₹"
                  className="mt-1 block font-display text-4xl font-bold text-foreground"
                />
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-background/60 py-3">
                    <p className="font-display text-lg font-semibold text-foreground">{earnings?.totalRides ?? 0}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Rides</p>
                  </div>
                  <div className="rounded-xl bg-background/60 py-3">
                    <p className="font-display text-lg font-semibold text-foreground">
                      {earnings?.totalDistanceKm ?? 0} km
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Distance</p>
                  </div>
                  <div className="rounded-xl bg-background/60 py-3">
                    <p className="font-display text-lg font-semibold text-foreground">{earnings?.onlineHours ?? 0}h</p>
                    <p className="mt-1 text-xs text-muted-foreground">Online</p>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>

          {earnings && earnings.rides.length > 0 && (
            <Card variant="default" className="mt-4 animate-slide-up">
              <CardContent className="p-4">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <TrendingUp size={15} className="text-primary" />
                  Earnings trend
                </div>
                <EarningsChart rides={earnings.rides} />
              </CardContent>
            </Card>
          )}

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-foreground">Ride-by-ride</p>
            {earnings?.rides.length === 0 && (
              <p className="text-sm text-muted-foreground">No rides in this period yet.</p>
            )}
            {earnings && earnings.rides.length > 0 && (
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                {earnings.rides.map((r) => (
                  <div key={r.rideId} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent">
                        <MapPinned size={15} className="text-foreground" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatDate(r.completedAt)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.distanceKm} km</p>
                      </div>
                    </div>
                    <FareBadge amount={r.fare} className="text-sm text-primary" />
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
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock4 size={11} />
                    {formatDate(payout.initiatedAt)}
                  </span>
                  <Badge variant={PAYOUT_STATUS_VARIANT[payout.status]} className="px-2 py-0 text-[10px]">
                    {PAYOUT_STATUS_LABEL[payout.status]}
                  </Badge>
                </div>
              </div>
              <FareBadge amount={payout.amount} className="text-sm" />
            </div>
          ))}
          {payouts?.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No payouts yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
