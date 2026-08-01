import { Button } from "@trylo/ui";
import Link from "next/link";

export function RouteStub({
  title,
  description,
  nextHref,
  nextLabel,
  checkpoint = "Checkpoint 2",
}: {
  title: string;
  description: string;
  nextHref?: string;
  nextLabel?: string;
  checkpoint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">{checkpoint}</span>
      <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      {nextHref && (
        <Button asChild>
          <Link href={nextHref}>{nextLabel ?? "Continue"}</Link>
        </Button>
      )}
    </div>
  );
}
