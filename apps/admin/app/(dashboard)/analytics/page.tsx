"use client";

import * as React from "react";
import { Card, Skeleton } from "@trylo/ui";
import type { AnalyticsPeriod } from "@trylo/types";
import { useAdminPaymentSuccessRate, useAdminRevenueTrend, useAdminRidesTrend } from "@trylo/mock-data/hooks";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PERIODS: AnalyticsPeriod[] = ["daily", "weekly", "monthly"];

const chartTooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = React.useState<AnalyticsPeriod>("daily");

  const { data: ridesTrend, isLoading: ridesLoading } = useAdminRidesTrend(period);
  const { data: revenueTrend, isLoading: revenueLoading } = useAdminRevenueTrend(period);
  const { data: successRate } = useAdminPaymentSuccessRate();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ride volume, revenue, and payment health over time.</p>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              }
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payments paid</p>
          <p className="mt-2 font-display text-xl font-semibold text-success">{successRate?.paid ?? "…"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payments failed</p>
          <p className="mt-2 font-display text-xl font-semibold text-destructive">{successRate?.failed ?? "…"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Success rate</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">{successRate?.successRate ?? "…"}%</p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm font-medium text-foreground">Rides — completed vs cancelled</p>
        <div className="mt-4 h-64 w-full">
          {ridesLoading || !ridesTrend ? (
            <Skeleton className="h-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ridesTrend.trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cancelled" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <p className="text-sm font-medium text-foreground">Revenue &amp; platform commission</p>
        <div className="mt-4 h-64 w-full">
          {revenueLoading || !revenueTrend ? (
            <Skeleton className="h-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend.trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip cursor={{ stroke: "hsl(var(--border))" }} contentStyle={chartTooltipStyle} formatter={(value: number) => `₹${value}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="commission" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
