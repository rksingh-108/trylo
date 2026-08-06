"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Premium empty-state — used for "no rides yet", "no saved places", "no results", etc. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0, 0, 0.2, 1] }}
      className={cn("flex flex-col items-center justify-center gap-4 px-8 py-14 text-center", className)}
    >
      {icon && (
        <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-muted to-muted/40 text-muted-foreground shadow-elevation-1 [&_svg]:h-9 [&_svg]:w-9">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold text-foreground">{title}</p>
        {description && <p className="text-balance text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}
