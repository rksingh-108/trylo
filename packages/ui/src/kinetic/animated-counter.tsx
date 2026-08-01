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
    return () => controls.stop();
  }, [value, durationSec]);

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {prefix}
      {display.toFixed(decimals)}
    </span>
  );
}
