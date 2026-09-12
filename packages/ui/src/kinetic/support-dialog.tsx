"use client";

import * as React from "react";
import { CheckCircle2, LifeBuoy, Loader2, Send } from "lucide-react";
import type { SupportTicket } from "@trylo/types";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/dialog";
import { Input } from "../components/input";
import { cn } from "../lib/cn";

interface SupportDialogProps {
  /** Tickets the user has already raised. */
  tickets?: SupportTicket[];
  isLoading?: boolean;
  /** Called when the user submits a new ticket. */
  onCreate: (input: { subject: string; message: string }) => void;
  isCreating?: boolean;
  /** Label for the trigger row's subtitle, e.g. "Reach us any time". */
  subtitle?: string;
  triggerClassName?: string;
  triggerIcon?: React.ReactNode;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * A live support center: users can raise a ticket and track its status. This is
 * the real support backend (SupportTicket rows created via /api/{role}/support),
 * not a mailto placeholder — raising a ticket lands in the admin panel's Support
 * page, and admins resolve it there.
 */
export function SupportDialog({
  tickets,
  isLoading,
  onCreate,
  isCreating,
  subtitle = "We usually reply within a few hours",
  triggerClassName,
  triggerIcon,
}: SupportDialogProps) {
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 5 || isCreating) return;
    onCreate({ subject: subject.trim(), message: message.trim() });
    setSubject("");
    setMessage("");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-elevation-1 transition-colors hover:bg-muted/60",
            triggerClassName
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
            {triggerIcon ?? <LifeBuoy size={18} className="text-foreground" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Help &amp; support</span>
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help &amp; support</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s going on — a support ticket is created and our team will get back to you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3">
          <Input
            placeholder="Subject (e.g. Issue with my last ride)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
          />
          <textarea
            placeholder="Describe the issue…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" disabled={subject.trim().length < 3 || message.trim().length < 5 || isCreating}>
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Submit ticket
          </Button>
        </form>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Your tickets</p>
          {isLoading ? (
            <p className="py-2 text-sm text-muted-foreground">Loading…</p>
          ) : tickets && tickets.length > 0 ? (
            <div className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      t.status === "resolved" ? "bg-success/15" : "bg-warning/15"
                    )}
                  >
                    {t.status === "resolved" ? (
                      <CheckCircle2 size={14} className="text-success" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-warning" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{t.subject}</p>
                      <Badge
                        variant={t.status === "resolved" ? "success" : "warning"}
                        className="px-2 py-0 text-[10px]"
                      >
                        {t.status === "resolved" ? "Resolved" : "Open"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(t.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">No tickets yet — raise one above.</p>
          )}
        </div>

        <DialogClose asChild>
          <Button variant="outline" className="mt-2 w-full">
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}