"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, IdCard, ShieldCheck, Upload } from "lucide-react";
import { Button, StatusPill } from "@trylo/ui";
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
    await uploadDoc.mutateAsync({ docId, fileName: file.name });
    setUploadingId(null);
    e.target.value = "";
  }

  const allUploaded = documents?.every((d) => d.status !== "not_uploaded") ?? false;

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-12">
      <h1 className="font-display text-2xl font-semibold text-foreground">Verify your documents</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload clear photos of each document. We'll review them shortly.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {documents?.map((doc) => {
          const Icon = DOC_ICONS[doc.type];
          const isUploading = uploadingId === doc.id;
          return (
            <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent">
                <Icon size={20} className="text-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.label}</p>
                <div className="mt-1">
                  <StatusPill status={doc.status} />
                </div>
              </div>
              <label className="shrink-0 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => handleFileChange(doc.id, e)}
                />
                <span className="grid h-9 w-9 place-items-center rounded-full border border-input transition-colors hover:bg-accent">
                  <Upload size={16} className="text-foreground" />
                </span>
              </label>
            </div>
          );
        })}
      </div>

      <Button size="lg" className="mt-auto" disabled={!allUploaded} onClick={() => router.push("/auth/vehicle")}>
        {allUploaded ? "Continue" : "Upload all documents to continue"}
      </Button>
    </div>
  );
}
