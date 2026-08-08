import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";
import { computeCommission } from "../lib/commission";

const router = Router();

const ACTIVE_STATUSES = ["requested", "matched", "arriving", "arrived", "in_progress"] as const;

router.get("/", requireAuth("admin"), async (_req, res) => {
  const [
    totalCustomers,
    totalDrivers,
    onlineDrivers,
    activeRides,
    completedRides,
    cancelledRides,
    revenueAgg,
    failedPayments,
    pendingDriverApprovals,
  ] = await Promise.all([
    db.user.count(),
    db.driver.count(),
    db.driver.count({ where: { isOnline: true } }),
    db.ride.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
    db.ride.count({ where: { status: "completed" } }),
    db.ride.count({ where: { status: "cancelled" } }),
    db.ride.aggregate({ where: { paymentStatus: "paid" }, _sum: { fareTotal: true } }),
    db.ride.count({ where: { paymentStatus: "failed" } }),
    db.driver.count({ where: { verificationStatus: "pending" } }),
  ]);

  const totalRevenue = revenueAgg._sum.fareTotal ?? 0;

  res.json({
    totalCustomers,
    totalDrivers,
    onlineDrivers,
    activeRides,
    completedRides,
    cancelledRides,
    totalRevenue,
    platformCommission: computeCommission(totalRevenue),
    failedPayments,
    pendingDriverApprovals,
  });
});

export default router;
