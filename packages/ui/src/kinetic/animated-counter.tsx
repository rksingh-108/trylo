"use client";

import * as React from "react";
import { animate } from "framer-motion";
import { cn } from "../lib/cn";

export interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  decimals?: number;
  className?: string;
  durationSec?: number;
}

export function AnimatedCounter({ value, prefix = "", decimals = 0, className, durationSec = 0.6 }: AnimatedCounterProps) {
  const [display, setDisplay] = React.useState(value);
  const prevValue = React.useRef(value);

  React.useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration: durationSec,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prevValue.current = value;
    // requestAnimationFrame-driven updates can stall (throttled/backgrounded tabs), so
    // guarantee the displayed value is eventually correct even if onUpdate never fires.
    const fallback = setTimeout(() => setDisplay(value), durationSec * 1000 + 100);
    return () => {
      controls.stop();
      clearTimeout(fallback);
    };
  }, [value, durationSec]);

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {prefix}
      {display.toFixed(decimals)}
    </span>
  );
}
