"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button, StatusPill } from "@trylo/ui";
import { useKycDocuments, useVerificationStatus } from "@trylo/mock-data/hooks";

export default function VerificationPendingPage() {
  const router = useRouter();
  const { data: status } = useVerificationStatus();
  const { data: documents } = useKycDocuments();

  React.useEffect(() => {
    if (status === "verified") {
      const t = setTimeout(() => router.push("/dashboard"), 1200);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (status === "verified") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-success/15">
          <CheckCircle2 size={32} className="text-success" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">You're verified!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Taking you to your dashboard...</p>
        </div>
        <Button size="lg" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-destructive/15">
          <XCircle size={32} className="text-destructive" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Verification failed</h1>
          <p className="mt-1 text-sm text-muted-foreground">One or more documents couldn't be verified.</p>
        </div>
        <Button size="lg" onClick={() => router.push("/auth/kyc")}>
          Re-submit documents
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20" />
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20 [animation-delay:0.6s]" />
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Clock size={24} />
        </span>
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground">Verification in progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This usually takes a few minutes. We'll notify you once you're approved.
        </p>
      </div>
      {documents && (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{doc.label}</span>
              <StatusPill status={doc.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
