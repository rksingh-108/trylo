"use client";

import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  Percent,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, Skeleton } from "@trylo/ui";
import { useAdminDashboard } from "@trylo/mock-data/hooks";

const STAT_ICONS = {
  totalCustomers: Users,
  totalDrivers: Car,
  onlineDrivers: Zap,
  activeRides: Clock,
  completedRides: CheckCircle2,
  cancelledRides: XCircle,
  totalRevenue: Wallet,
  platformCommission: Percent,
  failedPayments: AlertTriangle,
  pendingDriverApprovals: Clock,
} as const;

const STAT_LABELS: Record<keyof typeof STAT_ICONS, string> = {
  totalCustomers: "Total customers",
  totalDrivers: "Total drivers",
  onlineDrivers: "Online drivers",
  activeRides: "Active rides",
  completedRides: "Completed rides",
  cancelledRides: "Cancelled rides",
  totalRevenue: "Total ride revenue",
  platformCommission: "Platform commission",
  failedPayments: "Failed payments",
  pendingDriverApprovals: "Pending driver approvals",
};

const CURRENCY_KEYS = new Set(["totalRevenue", "platformCommission"]);

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useAdminDashboard();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Platform overview at a glance.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading || !stats
          ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : (Object.keys(STAT_ICONS) as Array<keyof typeof STAT_ICONS>).map((key) => {
              const Icon = STAT_ICONS[key];
              const value = stats[key];
              return (
                <Card key={key} className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {STAT_LABELS[key]}
                    </p>
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={16} />
                    </span>
                  </div>
                  <p className="mt-3 font-display text-2xl font-semibold text-foreground">
                    {CURRENCY_KEYS.has(key) ? `₹${value.toLocaleString("en-IN")}` : value.toLocaleString("en-IN")}
                  </p>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
