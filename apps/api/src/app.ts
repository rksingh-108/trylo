import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./env";
import { globalLimiter, otpLimiter } from "./lib/rateLimiters";
import authSessionRoutes from "./routes/authSession.routes";
import customerAuthRoutes from "./routes/customerAuth.routes";
import customerMiscRoutes from "./routes/customerMisc.routes";
import customerRideRoutes from "./routes/customerRide.routes";
import customerWalletRoutes from "./routes/customerWallet.routes";
import driverAuthRoutes from "./routes/driverAuth.routes";
import driverEarningsRoutes from "./routes/driverEarnings.routes";
import driverRideRoutes from "./routes/driverRide.routes";

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

  app.use("/api/driver/auth/otp", otpLimiter);
  app.use("/api/driver/auth", driverAuthRoutes);
  app.use("/api/driver", driverRideRoutes);
  app.use("/api/driver/earnings", driverEarningsRoutes);

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
