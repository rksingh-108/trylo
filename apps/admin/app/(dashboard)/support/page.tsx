"use client";

import { CheckCircle2, LifeBuoy } from "lucide-react";
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
import { useAdminSupportTickets, useResolveSupportTicket } from "@trylo/mock-data/hooks";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function AdminSupportPage() {
  const { data: tickets, isLoading } = useAdminSupportTickets();
  const resolveTicket = useResolveSupportTicket();

  async function handleResolve(id: string) {
    await resolveTicket.mutateAsync(id);
    toast.success("Ticket resolved");
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-foreground">Support</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tickets raised by customers and drivers.</p>

      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <Skeleton className="h-64 rounded-none" />
        ) : tickets && tickets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent">
                        <LifeBuoy size={14} className="text-foreground" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{ticket.owner.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.owner.role} · {ticket.owner.phone}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate text-sm font-medium text-foreground">
                    {ticket.subject}
                  </TableCell>
                  <TableCell className="max-w-[20rem] truncate text-sm text-muted-foreground">{ticket.message}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(ticket.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={ticket.status === "resolved" ? "success" : "warning"}>
                      {ticket.status === "resolved" ? "Resolved" : "Open"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {ticket.status === "open" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolveTicket.isPending}
                        onClick={() => handleResolve(ticket.id)}
                      >
                        <CheckCircle2 size={14} />
                        Resolve
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {ticket.resolvedAt ? formatDate(ticket.resolvedAt) : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<LifeBuoy />}
            title="No support tickets"
            description="Tickets raised by customers and drivers will show up here."
          />
        )}
      </Card>
    </div>
  );
}