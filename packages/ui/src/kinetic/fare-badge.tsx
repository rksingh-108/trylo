import { cn } from "../lib/cn";

export interface FareBadgeProps {
  amount: number;
  currency?: "INR";
  className?: string;
}

export function FareBadge({ amount, currency = "INR", className }: FareBadgeProps) {
  const symbol = currency === "INR" ? "₹" : currency;
  return (
    <span className={cn("font-mono text-lg font-semibold tabular-nums text-foreground", className)}>
      {symbol}
      {amount.toFixed(0)}
    </span>
  );
}
