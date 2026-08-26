// Must be imported before any Router is created/used - it patches Express's
// route-handler wiring so a rejected/thrown async handler reaches the error
// middleware below via next(err), instead of the request just hanging forever
// (Express 4 does not do this on its own; process.on("unhandledRejection") in
// index.ts only stops the whole process from crashing, it doesn't answer the
// specific in-flight request).
import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./env";
import { adminLoginLimiter, globalLimiter, otpLimiter } from "./lib/rateLimiters";
import authSessionRoutes from "./routes/authSession.routes";
import customerAuthRoutes from "./routes/customerAuth.routes";
import customerMiscRoutes from "./routes/customerMisc.routes";
import customerRideRoutes from "./routes/customerRide.routes";
import customerWalletRoutes from "./routes/customerWallet.routes";
import customerNotificationsRoutes from "./routes/customerNotifications.routes";
import driverAuthRoutes from "./routes/driverAuth.routes";
import driverEarningsRoutes from "./routes/driverEarnings.routes";
import driverRideRoutes from "./routes/driverRide.routes";
import driverNotificationsRoutes from "./routes/driverNotifications.routes";
import adminAuthRoutes from "./routes/adminAuth.routes";
import adminDashboardRoutes from "./routes/adminDashboard.routes";
import adminCustomersRoutes from "./routes/adminCustomers.routes";
import adminDriversRoutes from "./routes/adminDrivers.routes";
import adminRidesRoutes from "./routes/adminRides.routes";
import adminPaymentsRoutes from "./routes/adminPayments.routes";
import adminAnalyticsRoutes from "./routes/adminAnalytics.routes";
import adminNotificationsRoutes from "./routes/adminNotifications.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json());
  app.use(globalLimiter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authSessionRoutes);

  app.use("/api/customer/auth/otp", otpLimiter);
  app.use("/api/customer/auth", customerAuthRoutes);
  app.use("/api/customer", customerMiscRoutes);
  app.use("/api/customer/rides", customerRideRoutes);
  app.use("/api/customer/wallet", customerWalletRoutes);
  app.use("/api/customer/notifications", customerNotificationsRoutes);

  app.use("/api/driver/auth/otp", otpLimiter);
  app.use("/api/driver/auth", driverAuthRoutes);
  app.use("/api/driver", driverRideRoutes);
  app.use("/api/driver/earnings", driverEarningsRoutes);
  app.use("/api/driver/notifications", driverNotificationsRoutes);

  app.use("/api/admin/auth/login", adminLoginLimiter);
  app.use("/api/admin/auth", adminAuthRoutes);
  app.use("/api/admin/dashboard", adminDashboardRoutes);
  app.use("/api/admin/customers", adminCustomersRoutes);
  app.use("/api/admin/drivers", adminDriversRoutes);
  app.use("/api/admin/rides", adminRidesRoutes);
  app.use("/api/admin/payments", adminPaymentsRoutes);
  app.use("/api/admin/analytics", adminAnalyticsRoutes);
  app.use("/api/admin/notifications", adminNotificationsRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
