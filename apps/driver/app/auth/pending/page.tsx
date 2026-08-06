"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button, PageTransition, StatusPill } from "@trylo/ui";
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

  return (
    <PageTransition className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

      <AnimatePresence mode="wait">
        {status === "verified" ? (
          <motion.div
            key="verified"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
            className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center"
          >
            <span className="relative grid h-20 w-20 place-items-center rounded-full bg-success/15">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
              >
                <CheckCircle2 size={40} className="text-success" />
              </motion.span>
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">You're verified!</h1>
              <p className="mt-1 text-sm text-muted-foreground">Taking you to your dashboard...</p>
            </div>
            <Button size="lg" variant="glow" onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </Button>
          </motion.div>
        ) : status === "rejected" ? (
          <motion.div
            key="rejected"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center"
          >
            <span className="grid h-20 w-20 place-items-center rounded-full bg-destructive/15">
              <XCircle size={36} className="text-destructive" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Verification failed</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                One or more documents couldn't be verified. Review the flagged items below and resubmit.
              </p>
            </div>
            {documents && (
              <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-elevation-1">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{doc.label}</span>
                    <StatusPill status={doc.status} />
                  </div>
                ))}
              </div>
            )}
            <Button size="lg" onClick={() => router.push("/auth/kyc")}>
              Re-submit documents
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center"
          >
            <div className="relative flex h-28 w-28 items-center justify-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20 [animation-delay:0.6s]" />
              <span className="relative grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow">
                <Clock size={24} />
              </span>
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Verification in progress</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This usually takes a few minutes. We'll notify you the moment you're approved.
              </p>
              <p className="mt-3 font-mono text-xs uppercase tracking-widest text-primary">Est. wait: 2-5 min</p>
            </div>
            {documents && (
              <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-elevation-1">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{doc.label}</span>
                    <StatusPill status={doc.status} />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
