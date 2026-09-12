"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@trylo/ui";
import { useAdminDashboard } from "@trylo/mock-data/hooks";
import { useAdminDriverEarningsList, useAdminWalletTransactions } from "@trylo/mock-data/hooks";
import { useAdminPayouts, useProcessPayout, useRejectPayout } from "@trylo/mock-data/hooks";

export default function AdminPaymentsPage() {
  const { data: stats } = useAdminDashboard();
  const { data: transactions, isLoading: txnsLoading } = useAdminWalletTransactions({ limit: 50 });
  const { data: earnings, isLoading: earningsLoading } = useAdminDriverEarningsList({ limit: 50 });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-foreground">Payments</h1>
      <p className="mt-1 text-sm text-muted-foreground">Wallet transactions, driver earnings, and platform commission.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total ride revenue</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">₹{stats?.totalRevenue.toLocaleString("en-IN") ?? "…"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform commission</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">₹{stats?.platformCommission.toLocaleString("en-IN") ?? "…"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Failed payments</p>
          <p className="mt-2 font-display text-xl font-semibold text-destructive">{stats?.failedPayments ?? "…"}</p>
        </Card>
      </div>

      <Tabs defaultValue="wallet" className="mt-8">
        <TabsList>
          <TabsTrigger value="wallet">Wallet transactions</TabsTrigger>
          <TabsTrigger value="earnings">Driver earnings</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="wallet">
          {txnsLoading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{txn.userName}</p>
                      <p className="text-xs text-muted-foreground">{txn.userPhone}</p>
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{txn.category}</Badge>
                    </TableCell>
                    <TableCell className={txn.type === "credit" ? "text-success" : "text-destructive"}>
                      {txn.type === "credit" ? "+" : "-"}₹{txn.amount}
                    </TableCell>
                    <TableCell>{new Date(txn.createdAt).toLocaleDateString("en-IN")}</TableCell>
                  </TableRow>
                ))}
                {transactions?.transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No wallet transactions yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="earnings">
          {earningsLoading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Drop</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings?.earnings.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{entry.driverName}</p>
                      <p className="text-xs text-muted-foreground">{entry.driverPhone}</p>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{entry.dropAddress}</TableCell>
                    <TableCell>{entry.distanceKm} km</TableCell>
                    <TableCell>
                      <span className="text-success">+₹{entry.amount}</span>
                      {entry.tip > 0 && <span className="ml-1 text-xs text-success">+₹{entry.tip} tip</span>}
                    </TableCell>
                    <TableCell>{new Date(entry.createdAt).toLocaleDateString("en-IN")}</TableCell>
                  </TableRow>
                ))}
                {earnings?.earnings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No driver earnings yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="payouts">
          <AdminPayoutsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminPayoutsSection() {
  const { data: payouts, isLoading } = useAdminPayouts();
  const processPayout = useProcessPayout();
  const rejectPayout = useRejectPayout();

  async function handleProcess(id: string) {
    try {
      await processPayout.mutateAsync(id);
      toast.success("Payout processed");
    } catch {
      toast.error("Failed to process payout");
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectPayout.mutateAsync(id);
      toast.success("Payout rejected");
    } catch {
      toast.error("Failed to reject payout");
    }
  }

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  if (!payouts || payouts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No payout requests yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Driver</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Bank (last 4)</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payouts.map((p) => {
          const statusVariant = p.status === "processed" ? "success" : p.status === "failed" ? "destructive" : ("outline" as const);
          return (
            <TableRow key={p.id}>
              <TableCell className="text-sm font-medium text-foreground">{p.driver.name}</TableCell>
              <TableCell className="font-mono text-sm">₹{p.amount}</TableCell>
              <TableCell className="text-sm text-muted-foreground">****{p.bankAccountLast4}</TableCell>
              <TableCell>
                <Badge variant={statusVariant}>{p.status}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(p.initiatedAt).toLocaleDateString("en-IN")}
              </TableCell>
              <TableCell className="text-right">
                {p.status === "pending" ? (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" disabled={processPayout.isPending} onClick={() => handleProcess(p.id)}>
                      <CheckCircle2 size={14} />
                    </Button>
                    <Button size="sm" variant="outline" disabled={rejectPayout.isPending} onClick={() => handleReject(p.id)}>
                      <XCircle size={14} />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {p.processedAt ? new Date(p.processedAt).toLocaleDateString("en-IN") : "—"}
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
