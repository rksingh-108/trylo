import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-muted", className)}
      {...props}
    >
      <div className="absolute inset-0 animate-shimmer bg-shimmer" />
    </div>
  );
}
