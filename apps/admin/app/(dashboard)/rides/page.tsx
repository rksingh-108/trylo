"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Input, Label, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@trylo/ui";
import type { PaymentStatus, RideStatus } from "@trylo/types";
import { useAdminRides } from "@trylo/mock-data/hooks";

const RIDE_STATUSES: Array<RideStatus | "all"> = [
  "all",
  "requested",
  "matched",
  "arriving",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
];
const PAYMENT_STATUSES: Array<PaymentStatus | "all"> = ["all", "pending", "paid", "failed"];

export default function AdminRidesPage() {
  const [status, setStatus] = React.useState<RideStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus | "all">("all");
  const [customerId, setCustomerId] = React.useState("");
  const [driverId, setDriverId] = React.useState("");

  const { data, isLoading } = useAdminRides({
    status: status === "all" ? undefined : status,
    paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
    customerId: customerId || undefined,
    driverId: driverId || undefined,
    limit: 50,
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-foreground">Rides</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data?.total ?? "…"} rides matching filters.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RideStatus | "all")}
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground"
          >
            {RIDE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Payment status</Label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus | "all")}
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground"
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All payment statuses" : s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Customer ID</Label>
          <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Filter by customer ID" className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Driver ID</Label>
          <Input value={driverId} onChange={(e) => setDriverId(e.target.value)} placeholder="Filter by driver ID" className="h-10" />
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rider</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Fare</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rides.map((ride) => (
                <TableRow key={ride.id}>
                  <TableCell>
                    <Link href={`/rides/${ride.id}`} className="font-medium text-primary hover:underline">
                      {ride.rider?.name ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{ride.driver?.name ?? "Unmatched"}</TableCell>
                  <TableCell>₹{ride.fare.total}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ride.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ride.paymentStatus === "paid" ? "success" : ride.paymentStatus === "failed" ? "destructive" : "outline"}>
                      {ride.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(ride.requestedAt).toLocaleDateString("en-IN")}</TableCell>
                </TableRow>
              ))}
              {data?.rides.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No rides found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
