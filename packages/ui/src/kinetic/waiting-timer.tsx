"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";

/**
 * Elapsed seconds since `anchorIso`, ticking once a second. Recomputed fresh
 * from the timestamp on every tick (never accumulated client-side), so it's
 * immune to setInterval drift and naturally survives a page refresh — the
 * anchor is a server timestamp (e.g. `ride.arrivedAt`), not "when did this
 * component mount" client state.
 */
export function useElapsedSeconds(anchorIso: string | undefined): number {
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    if (!anchorIso) return;
    const id = setInterval(forceTick, 1000);
    return () => clearInterval(id);
  }, [anchorIso]);

  if (!anchorIso) return 0;
  const elapsed = Math.floor((Date.now() - new Date(anchorIso).getTime()) / 1000);
  return Math.max(0, elapsed);
}

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface WaitingTimerProps {
  /** Server timestamp the timer counts up from — typically `ride.arrivedAt`. */
  anchorIso: string | undefined;
  /** Caption shown above the timer. Pass "" to omit it (e.g. when a heading elsewhere already says "Waiting Time"). */
  label?: string;
  className?: string;
}

/** "Waiting time 00:42" live counter, anchored to a server timestamp. */
export function WaitingTimer({ anchorIso, label = "Waiting time", className }: WaitingTimerProps) {
  const elapsed = useElapsedSeconds(anchorIso);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 220 }}
      className={cn("text-right", className)}
    >
      {label && <p className="text-[11px] text-muted-foreground">{label}</p>}
      <p className="font-mono text-xl font-semibold tabular-nums text-foreground">{formatElapsed(elapsed)}</p>
    </motion.div>
  );
}
