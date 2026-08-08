"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@trylo/ui";
import { useAdminDrivers } from "@trylo/mock-data/hooks";

const STATUS_OPTIONS = ["all", "pending", "verified", "rejected"] as const;

export default function AdminDriversPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_OPTIONS)[number]>("all");

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useAdminDrivers({
    search: debouncedSearch || undefined,
    verificationStatus: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-foreground">Drivers</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data?.total ?? "…"} total drivers.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
            className="h-10 pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={
                statusFilter === status
                  ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              }
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.drivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell>
                    <Link href={`/drivers/${driver.id}`} className="font-medium text-primary hover:underline">
                      {driver.name || "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{driver.phone}</TableCell>
                  <TableCell>
                    {driver.vehicle.make} {driver.vehicle.model}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        driver.verificationStatus === "verified"
                          ? "success"
                          : driver.verificationStatus === "rejected"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {driver.verificationStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{driver.isOnline ? <Badge variant="success">Online</Badge> : <Badge variant="outline">Offline</Badge>}</TableCell>
                  <TableCell>
                    {driver.suspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="outline">Active</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {data?.drivers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No drivers found.
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
