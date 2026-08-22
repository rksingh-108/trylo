"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { Button } from "../components/button";

export interface SosConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

/**
 * Confirmation gate for the in-app SOS/emergency alert - requires an explicit
 * second tap so it can't be triggered by an accidental press of the SOS
 * button. Honest about scope: TRYLO has no integration with a real emergency
 * dispatch/SMS/telephony provider, so the copy here must never claim it does.
 */
export function SosConfirmSheet({ open, onOpenChange, onConfirm, isPending }: SosConfirmSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="items-center text-center">
          <span className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-destructive/15">
            <AlertTriangle size={22} className="text-destructive" />
          </span>
          <SheetTitle>Send emergency alert?</SheetTitle>
          <p className="text-sm text-muted-foreground">
            This sends an in-app alert to TRYLO support with your ride details. This is not a call to emergency
            services - if you&apos;re in immediate danger, contact local emergency services directly.
          </p>
        </SheetHeader>
        <div className="flex flex-col gap-2">
          <Button variant="destructive" size="lg" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Sending alert..." : "Send alert"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
