"use client";

import {
  Badge,
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
} from "@trylo/ui";
import { useAdminDashboard } from "@trylo/mock-data/hooks";
import { useAdminDriverEarningsList, useAdminWalletTransactions } from "@trylo/mock-data/hooks";

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
                    <TableCell className="text-success">+₹{entry.amount}</TableCell>
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
      </Tabs>
    </div>
  );
}
