import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { serializeDriver, serializeKycDocument, serializeRide } from "../lib/serialize";
import { logAdminAction } from "../lib/adminAudit";

const router = Router();

const listSchema = z.object({
  search: z.string().optional(),
  verificationStatus: z.enum(["pending", "verified", "rejected"]).optional(),
  isOnline: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get("/", requireAuth("admin"), async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { search, verificationStatus, isOnline, page, limit } = parsed.data;

  const where = {
    ...(search
      ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { phone: { contains: search } }] }
      : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(isOnline !== undefined ? { isOnline } : {}),
  };

  const [drivers, total] = await Promise.all([
    db.driver.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    db.driver.count({ where }),
  ]);

  res.json({
    drivers: drivers.map((d) => ({ ...serializeDriver(d), suspended: d.suspended })),
    total,
    page,
    limit,
  });
});

router.get("/:id", requireAuth("admin"), async (req, res) => {
  const driver = await db.driver.findUnique({ where: { id: req.params.id } });
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  res.json({ ...serializeDriver(driver), suspended: driver.suspended });
});

router.get("/:id/kyc", requireAuth("admin"), async (req, res) => {
  const docs = await db.kycDocument.findMany({ where: { driverId: req.params.id } });
  res.json(docs.map(serializeKycDocument));
});

router.get("/:id/rides", requireAuth("admin"), async (req, res) => {
  const rides = await db.ride.findMany({
    where: { driverId: req.params.id },
    include: { driver: true, rider: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(rides.map(serializeRide));
});

router.get("/:id/earnings", requireAuth("admin"), async (req, res) => {
  const earnings = await db.driverEarning.findMany({
    where: { driverId: req.params.id },
    include: { ride: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    totalEarnings: earnings.reduce((sum, e) => sum + e.amount, 0),
    totalRides: earnings.length,
    rides: earnings.map((e) => ({
      rideId: e.rideId,
      fare: e.amount,
      distanceKm: e.ride.distanceKm,
      completedAt: e.createdAt.toISOString(),
    })),
  });
});

router.post("/:id/approve", requireAuth("admin"), async (req, res) => {
  const driver = await db.driver
    .update({ where: { id: req.params.id }, data: { verificationStatus: "verified" } })
    .catch(() => null);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  // Same consistency fix as /reject below, mirrored: the Approve button has no
  // guard requiring documents to already be verified, so without this an admin
  // could approve a driver whose KYC screen still shows pending/rejected docs.
  await db.kycDocument.updateMany({
    where: { driverId: driver.id, status: { in: ["pending_review", "rejected"] } },
    data: { status: "verified" },
  });
  await logAdminAction(req.auth!.id, "driver_approved", "driver", driver.id);
  res.json({ ...serializeDriver(driver), suspended: driver.suspended });
});

const rejectSchema = z.object({ reason: z.string().optional() });

router.post("/:id/reject", requireAuth("admin"), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body ?? {});
  const driver = await db.driver
    .update({ where: { id: req.params.id }, data: { verificationStatus: "rejected" } })
    .catch(() => null);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  // Keep each document's own status consistent with the driver-level rejection -
  // previously only verificationStatus changed, so the driver's KYC screen kept
  // showing every document as "Verified" with nothing actually flagged. Only
  // touches docs that were verified/under review; a document never uploaded
  // stays "not_uploaded", not "rejected".
  await db.kycDocument.updateMany({
    where: { driverId: driver.id, status: { in: ["verified", "pending_review"] } },
    data: { status: "rejected" },
  });
  await logAdminAction(req.auth!.id, "driver_rejected", "driver", driver.id, parsed.success ? parsed.data.reason : undefined);
  res.json({ ...serializeDriver(driver), suspended: driver.suspended });
});

const suspendSchema = z.object({ reason: z.string().optional() });

router.post("/:id/suspend", requireAuth("admin"), async (req, res) => {
  const parsed = suspendSchema.safeParse(req.body ?? {});
  const driver = await db.driver.update({ where: { id: req.params.id }, data: { suspended: true } }).catch(() => null);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  await logAdminAction(req.auth!.id, "driver_suspended", "driver", driver.id, parsed.success ? parsed.data.reason : undefined);
  res.json({ ...serializeDriver(driver), suspended: driver.suspended });
});

router.post("/:id/unsuspend", requireAuth("admin"), async (req, res) => {
  const driver = await db.driver.update({ where: { id: req.params.id }, data: { suspended: false } }).catch(() => null);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  await logAdminAction(req.auth!.id, "driver_unsuspended", "driver", driver.id);
  res.json({ ...serializeDriver(driver), suspended: driver.suspended });
});

export default router;
