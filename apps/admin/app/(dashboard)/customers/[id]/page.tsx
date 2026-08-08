"use client";

import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
  toast,
} from "@trylo/ui";
import {
  useAdminCustomer,
  useAdminCustomerRides,
  useAdminCustomerWallet,
  useSuspendAdminCustomer,
  useUnsuspendAdminCustomer,
} from "@trylo/mock-data/hooks";

export default function AdminCustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id ?? null;

  const { data: customer, isLoading } = useAdminCustomer(id);
  const { data: rides } = useAdminCustomerRides(id);
  const { data: wallet } = useAdminCustomerWallet(id);
  const suspend = useSuspendAdminCustomer();
  const unsuspend = useUnsuspendAdminCustomer();

  async function toggleSuspension() {
    if (!id || !customer) return;
    if (customer.suspended) {
      await unsuspend.mutateAsync(id);
      toast.success("Customer unsuspended");
    } else {
      await suspend.mutateAsync({ id, reason: "Suspended via admin panel" });
      toast.success("Customer suspended");
    }
  }

  if (isLoading || !customer) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/customers")}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Back to customers
      </button>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">{customer.name || "Unnamed rider"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{customer.phone}</p>
        </div>
        <div className="flex items-center gap-3">
          {customer.suspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="success">Active</Badge>}
          <Button
            variant={customer.suspended ? "outline" : "destructive"}
            size="sm"
            onClick={toggleSuspension}
            disabled={suspend.isPending || unsuspend.isPending}
          >
            {customer.suspended ? "Unsuspend" : "Suspend"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rating</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">{customer.rating.toFixed(1)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet balance</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">₹{wallet?.balance ?? customer.walletBalance}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total rides</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">{rides?.length ?? "…"}</p>
        </Card>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-foreground">Ride history</h2>
      <div className="mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Drop</TableHead>
              <TableHead>Fare</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rides?.map((ride) => (
              <TableRow key={ride.id}>
                <TableCell className="max-w-xs truncate">{ride.drop.address}</TableCell>
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
            {rides?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No rides yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-foreground">Wallet transactions</h2>
      <div className="mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallet?.transactions.map((txn) => (
              <TableRow key={txn.id}>
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
            {wallet?.transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
