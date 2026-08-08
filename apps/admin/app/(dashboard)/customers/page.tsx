"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@trylo/ui";
import { useAdminCustomers } from "@trylo/mock-data/hooks";

export default function AdminCustomersPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useAdminCustomers({ search: debouncedSearch || undefined, limit: 50 });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-foreground">Customers</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data?.total ?? "…"} total riders.</p>

      <div className="relative mt-6 max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone"
          className="h-10 pl-9"
        />
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
                <TableHead>Rating</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                      {customer.name || "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.rating.toFixed(1)}</TableCell>
                  <TableCell>₹{customer.walletBalance}</TableCell>
                  <TableCell>
                    {customer.suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No customers found.
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
