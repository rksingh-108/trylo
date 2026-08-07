"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { Button } from "../components/button";
import { cn } from "../lib/cn";

export const CUSTOMER_CANCEL_REASONS = [
  "Driver is taking too long",
  "Wrong pickup location",
  "Changed my mind",
  "Found another ride",
  "Price too high",
  "Other",
];

export const DRIVER_CANCEL_REASONS = [
  "Rider is not reachable",
  "Rider requested cancellation",
  "Wrong pickup location",
  "Vehicle issue",
  "Other",
];

export interface CancelRideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: string[];
  onConfirm: (reason: string) => void;
  isPending?: boolean;
  title?: string;
  description?: string;
}

/** Uber-style cancellation confirmation — a bottom sheet with reason selection, not a blocking dialog. */
export function CancelRideSheet({
  open,
  onOpenChange,
  reasons,
  onConfirm,
  isPending,
  title = "Cancel ride?",
  description = "Let us know why — this helps us improve matching.",
}: CancelRideSheetProps) {
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="items-center text-center">
          <span className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-destructive/15">
            <AlertTriangle size={22} className="text-destructive" />
          </span>
          <SheetTitle>{title}</SheetTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          {reasons.map((reason) => {
            const isSelected = selected === reason;
            return (
              <button
                key={reason}
                type="button"
                onClick={() => setSelected(reason)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-foreground hover:bg-accent"
                )}
              >
                {reason}
                {isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check size={12} />
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="destructive"
            size="lg"
            disabled={!selected || isPending}
            onClick={() => selected && onConfirm(selected)}
          >
            {isPending ? "Cancelling…" : "Confirm cancellation"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={isPending}>
            Keep ride
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
