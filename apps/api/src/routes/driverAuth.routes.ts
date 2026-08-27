import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { createOtpChallenge, verifyOtpChallenge } from "../auth/otp";
import { signToken } from "../auth/jwt";
import { requireAuth } from "../auth/middleware";
import { issueRefreshToken } from "../auth/refreshToken";
import { serializeDriver, serializeKycDocument } from "../lib/serialize";
import { CITY_CENTER, jitter } from "../lib/geo";
import { autoVerifyPendingDocs } from "../lib/kyc";

const router = Router();

const KYC_DOC_DEFS = [
  { type: "license" as const, label: "Driving License" },
  { type: "rc" as const, label: "Vehicle RC" },
  { type: "insurance" as const, label: "Insurance" },
  { type: "profile_photo" as const, label: "Profile Photo" },
];

const phoneSchema = z.object({ phone: z.string().min(6) });

router.post("/otp/request", async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid phone" });
    return;
  }
  const devHintOtp = await createOtpChallenge(parsed.data.phone, "driver");
  res.json({ requestId: `otpreq_${Date.now()}`, devHintOtp });
});

const verifySchema = z.object({ phone: z.string().min(6), otp: z.string().length(4) });

router.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { phone, otp } = parsed.data;
  const success = await verifyOtpChallenge(phone, "driver", otp);
  if (!success) {
    res.json({ success: false, isNewDriver: false, driver: null });
    return;
  }

  let driver = await db.driver.findUnique({ where: { phone } });
  const isNewDriver = !driver;
  if (!driver) {
    const location = jitter(CITY_CENTER, 3);
    driver = await db.driver.create({
      data: { phone, lat: location.lat, lng: location.lng, locationUpdatedAt: new Date() },
    });
    await db.kycDocument.createMany({
      data: KYC_DOC_DEFS.map((d) => ({ driverId: driver!.id, type: d.type, label: d.label })),
    });
  }

  if (driver.suspended) {
    res.json({ success: false, isNewDriver: false, driver: null, reason: "suspended" });
    return;
  }

  const token = signToken({ sub: driver.id, role: "driver" });
  const refreshToken = await issueRefreshToken(driver.id, "driver", req.headers["user-agent"]);
  res.json({ success: true, isNewDriver, driver: serializeDriver(driver), token, refreshToken });
});

const vehicleSchema = z.object({
  name: z.string().min(1),
  vehicleType: z.enum(["bike", "auto", "cab"]),
  make: z.string().min(1),
  model: z.string().min(1),
  registrationNumber: z.string().min(1),
  color: z.string().min(1),
});

router.post("/vehicle", requireAuth("driver"), async (req, res) => {
  const parsed = vehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid vehicle details" });
    return;
  }
  const driver = await db.driver.update({
    where: { id: req.auth!.id },
    data: parsed.data,
  });
  res.json(serializeDriver(driver));
});

const markerStyleSchema = z.object({ markerStyle: z.enum(["classic", "arrow", "beacon", "compact"]) });

router.post("/marker-style", requireAuth("driver"), async (req, res) => {
  const parsed = markerStyleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid marker style" });
    return;
  }
  const driver = await db.driver.update({
    where: { id: req.auth!.id },
    data: { markerStyle: parsed.data.markerStyle },
  });
  res.json(serializeDriver(driver));
});

router.get("/me", requireAuth("driver"), async (req, res) => {
  const driver = await db.driver.findUnique({ where: { id: req.auth!.id } });
  res.json(driver ? serializeDriver(driver) : null);
});

router.get("/kyc", requireAuth("driver"), async (req, res) => {
  await autoVerifyPendingDocs(req.auth!.id);
  const refreshed = await db.kycDocument.findMany({ where: { driverId: req.auth!.id } });
  res.json(refreshed.map(serializeKycDocument));
});

const uploadSchema = z.object({ fileName: z.string().min(1) });

router.post("/kyc/:docId/upload", requireAuth("driver"), async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload" });
    return;
  }
  const doc = await db.kycDocument.findFirst({ where: { id: req.params.docId, driverId: req.auth!.id } });
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const updated = await db.kycDocument.update({
    where: { id: doc.id },
    data: { status: "pending_review", fileName: parsed.data.fileName, uploadedAt: new Date() },
  });
  res.json(serializeKycDocument(updated));
});

router.get("/verification-status", requireAuth("driver"), async (req, res) => {
  await autoVerifyPendingDocs(req.auth!.id);
  const docs = await db.kycDocument.findMany({ where: { driverId: req.auth!.id } });
  const allVerified = docs.length > 0 && docs.every((d) => d.status === "verified");

  let driver = await db.driver.findUnique({ where: { id: req.auth!.id } });
  // Also handles "rejected" - a driver an admin rejected can resubmit every
  // document and, once they all re-verify, become verified again on their
  // own; previously only "pending" could ever transition here, so a rejected
  // driver who did everything asked of them stayed stuck until an admin
  // manually re-approved them.
  if (allVerified && driver && (driver.verificationStatus === "pending" || driver.verificationStatus === "rejected")) {
    driver = await db.driver.update({ where: { id: driver.id }, data: { verificationStatus: "verified" } });
  }

  res.json(driver?.verificationStatus ?? "pending");
});

export default router;
