"use client";

import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, UserX } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
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
  useAdminDriver,
  useAdminDriverEarnings,
  useAdminDriverKyc,
  useAdminDriverRides,
  useApproveAdminDriver,
  useRejectAdminDriver,
  useSuspendAdminDriver,
  useUnsuspendAdminDriver,
} from "@trylo/mock-data/hooks";

export default function AdminDriverDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id ?? null;

  const { data: driver, isLoading } = useAdminDriver(id);
  const { data: kyc } = useAdminDriverKyc(id);
  const { data: rides } = useAdminDriverRides(id);
  const { data: earnings } = useAdminDriverEarnings(id);
  const approve = useApproveAdminDriver();
  const reject = useRejectAdminDriver();
  const suspend = useSuspendAdminDriver();
  const unsuspend = useUnsuspendAdminDriver();

  async function toggleSuspension() {
    if (!id || !driver) return;
    if (driver.suspended) {
      await unsuspend.mutateAsync(id);
      toast.success("Driver unsuspended");
    } else {
      await suspend.mutateAsync({ id, reason: "Suspended via admin panel" });
      toast.success("Driver suspended");
    }
  }

  async function handleApprove() {
    if (!id) return;
    await approve.mutateAsync(id);
    toast.success("Driver approved");
  }

  async function handleReject() {
    if (!id) return;
    await reject.mutateAsync({ id, reason: "Rejected via admin panel" });
    toast.success("Driver rejected");
  }

  if (isLoading) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  if (!driver) {
    return (
      <EmptyState
        icon={<UserX />}
        title="Driver not found"
        description="This driver doesn't exist or may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push("/drivers")}>
            Back to drivers
          </Button>
        }
      />
    );
  }

  const actionsPending = approve.isPending || reject.isPending || suspend.isPending || unsuspend.isPending;

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/drivers")}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Back to drivers
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">{driver.name || "Unnamed driver"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{driver.phone}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              driver.verificationStatus === "verified" ? "success" : driver.verificationStatus === "rejected" ? "destructive" : "warning"
            }
          >
            {driver.verificationStatus}
          </Badge>
          {driver.suspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="outline">Active</Badge>}
          {driver.verificationStatus !== "verified" && (
            <Button size="sm" onClick={handleApprove} disabled={actionsPending}>
              Approve
            </Button>
          )}
          {driver.verificationStatus !== "rejected" && (
            <Button size="sm" variant="outline" onClick={handleReject} disabled={actionsPending}>
              Reject
            </Button>
          )}
          <Button variant={driver.suspended ? "outline" : "destructive"} size="sm" onClick={toggleSuspension} disabled={actionsPending}>
            {driver.suspended ? "Unsuspend" : "Suspend"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle</p>
          <p className="mt-2 font-display text-lg font-semibold text-foreground">
            {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
          </p>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{driver.vehicle.registrationNumber}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rating</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">{driver.rating.toFixed(1)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total earnings</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">₹{earnings?.totalEarnings ?? 0}</p>
        </Card>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-foreground">KYC documents</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kyc?.map((doc) => (
          <Card key={doc.id} className="p-4">
            <p className="text-sm font-medium text-foreground">{doc.label}</p>
            <div className="mt-2">
              <Badge
                variant={doc.status === "verified" ? "success" : doc.status === "rejected" ? "destructive" : "warning"}
              >
                {doc.status.replace("_", " ")}
              </Badge>
            </div>
          </Card>
        ))}
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
    </div>
  );
}
