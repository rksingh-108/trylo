"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/** App-root toast host. Mount once per app inside <Providers>. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group rounded-2xl border border-border bg-card text-card-foreground shadow-elevation-3 px-4 py-3 font-body",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground rounded-lg",
          cancelButton: "bg-muted text-muted-foreground rounded-lg",
          success: "!border-success/30",
          error: "!border-destructive/30",
        },
      }}
    />
  );
}

export { toast };
