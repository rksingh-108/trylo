import { cn } from "../lib/cn";

export type KineticStatus =
  | "requested"
  | "matched"
  | "arriving"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "pending"
  | "verified"
  | "rejected"
  | "not_uploaded"
  | "pending_review";

const STATUS_CONFIG: Record<KineticStatus, { label: string; className: string }> = {
  requested: { label: "Finding driver", className: "bg-amber-100 text-amber-700" },
  matched: { label: "Driver matched", className: "bg-teal-100 text-teal-700" },
  arriving: { label: "Driver is arriving", className: "bg-teal-100 text-teal-700" },
  arrived: { label: "Driver has arrived", className: "bg-primary/15 text-primary" },
  in_progress: { label: "On trip", className: "bg-primary/15 text-primary" },
  completed: { label: "Completed", className: "bg-success/15 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
  pending: { label: "Pending", className: "bg-warning/20 text-warning" },
  verified: { label: "Verified", className: "bg-success/15 text-success" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
  not_uploaded: { label: "Not uploaded", className: "bg-muted text-muted-foreground" },
  pending_review: { label: "Under review", className: "bg-warning/20 text-warning" },
};

export interface StatusPillProps {
  status: KineticStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", config.className, className)}>
      {config.label}
    </span>
  );
}
