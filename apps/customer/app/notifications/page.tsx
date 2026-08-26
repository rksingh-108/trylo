"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronLeft } from "lucide-react";
import { Button, EmptyState, PageTransition, Skeleton, cn } from "@trylo/ui";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@trylo/mock-data/hooks";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = notifications?.some((n) => !n.read) ?? false;

  return (
    <PageTransition className="flex flex-1 flex-col px-5 pb-8 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card shadow-elevation-1"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="font-display text-xl font-semibold text-foreground">Notifications</h1>
        </div>
        {hasUnread && (
          <Button variant="ghost" size="sm" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}

        {!isLoading && notifications?.length === 0 && (
          <EmptyState icon={<Bell />} title="No notifications yet" description="Updates about your rides will show up here." />
        )}

        {notifications?.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => !n.read && markRead.mutate(n.id)}
            className={cn(
              "flex flex-col gap-0.5 rounded-xl border p-4 text-left transition-colors",
              n.read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              <p className="text-sm font-medium text-foreground">{n.title}</p>
            </div>
            <p className="text-xs text-muted-foreground">{n.body}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(n.createdAt)}</p>
          </button>
        ))}
      </div>
    </PageTransition>
  );
}
