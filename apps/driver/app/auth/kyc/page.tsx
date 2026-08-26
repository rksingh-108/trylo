"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, Check, FileText, IdCard, Loader2, ShieldCheck, Upload } from "lucide-react";
import { Button, cn, PageTransition, StatusPill, toast } from "@trylo/ui";
import { useKycDocuments, useUploadKycDocument } from "@trylo/mock-data/hooks";
import type { KycDocument } from "@trylo/types";

const DOC_ICONS: Record<KycDocument["type"], React.ComponentType<{ size?: number; className?: string }>> = {
  license: IdCard,
  rc: FileText,
  insurance: ShieldCheck,
  profile_photo: Camera,
};

export default function KycPage() {
  const router = useRouter();
  const { data: documents } = useKycDocuments();
  const uploadDoc = useUploadKycDocument();
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);

  async function handleFileChange(docId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(docId);
    try {
      await uploadDoc.mutateAsync({ docId, fileName: file.name });
      toast.success("Document uploaded");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  }

  const allUploaded = documents?.every((d) => d.status !== "not_uploaded") ?? false;

  return (
    <PageTransition className="relative flex flex-1 flex-col overflow-hidden px-6 pb-8 pt-12">
      <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[90px]" />

      <div className="relative">
        <h1 className="font-display text-2xl font-semibold text-foreground">Verify your documents</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload clear photos of each document. We'll review them shortly.
        </p>
      </div>

      <div className="relative mt-6 flex flex-col gap-3">
        {documents?.map((doc, i) => {
          const Icon = DOC_ICONS[doc.type];
          const isUploading = uploadingId === doc.id;
          const isVerified = doc.status === "verified";
          const isPending = doc.status === "pending_review";
          return (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25, ease: [0, 0, 0.2, 1] }}
              className={cn(
                "relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-elevation-1 transition-colors",
                isPending ? "border-warning/30" : isVerified ? "border-success/30" : "border-border"
              )}
            >
              {isUploading && <span className="absolute inset-0 animate-shimmer bg-shimmer" />}
              <span
                className={cn(
                  "relative grid h-11 w-11 shrink-0 place-items-center rounded-full",
                  isVerified ? "bg-success/15" : isPending ? "bg-warning/15" : "bg-accent"
                )}
              >
                {isVerified ? (
                  <Check size={20} className="text-success" />
                ) : (
                  <Icon size={20} className={isPending ? "text-warning" : "text-foreground"} />
                )}
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.label}</p>
                <div className="mt-1">
                  <StatusPill status={doc.status} />
                </div>
              </div>
              <label className="relative shrink-0 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => handleFileChange(doc.id, e)}
                />
                <span className="grid h-9 w-9 place-items-center rounded-full border border-input transition-colors hover:border-primary hover:bg-primary/5">
                  {isUploading ? (
                    <Loader2 size={16} className="animate-spin text-primary" />
                  ) : (
                    <Upload size={16} className="text-foreground" />
                  )}
                </span>
              </label>
            </motion.div>
          );
        })}
      </div>

      <Button
        size="lg"
        variant={allUploaded ? "glow" : "default"}
        className="relative mt-auto"
        disabled={!allUploaded}
        onClick={() => router.push("/auth/vehicle")}
      >
        {allUploaded ? "Continue" : "Upload all documents to continue"}
      </Button>
    </PageTransition>
  );
}
