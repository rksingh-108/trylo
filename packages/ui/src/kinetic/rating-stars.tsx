"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "../lib/cn";

export interface RatingStarsProps {
  value: number;
  max?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

export function RatingStars({ value, max = 5, size = 20, interactive = false, onChange, className }: RatingStarsProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(display);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(i + 1)}
            onMouseEnter={() => interactive && setHovered(i + 1)}
            onMouseLeave={() => interactive && setHovered(null)}
            className={cn(!interactive && "cursor-default")}
            aria-label={`${i + 1} star`}
          >
            <Star
              size={size}
              className={cn(filled ? "fill-amber-500 text-amber-500" : "fill-transparent text-muted-foreground")}
            />
          </button>
        );
      })}
    </div>
  );
}
