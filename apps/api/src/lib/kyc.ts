import { db } from "../db";

const AUTO_VERIFY_AFTER_MS = 4000;

/** Flips any `pending_review` document to `verified` once it's been under review long enough. */
export async function autoVerifyPendingDocs(driverId: string): Promise<void> {
  const docs = await db.kycDocument.findMany({ where: { driverId } });
  const now = Date.now();
  const dueForVerification = docs.filter(
    (d) => d.status === "pending_review" && d.uploadedAt && now - d.uploadedAt.getTime() > AUTO_VERIFY_AFTER_MS
  );
  if (dueForVerification.length === 0) return;

  await Promise.all(
    dueForVerification.map((d) => db.kycDocument.update({ where: { id: d.id }, data: { status: "verified" } }))
  );
}
