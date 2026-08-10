import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync } from "fs";
import { createApp } from "./app";
import { env } from "./env";
import { initSocketServer } from "./realtime/io";
import { startMatchingLoop } from "./matching/matcher";

// Route handlers here are async functions registered directly with Express,
// which does not catch async errors on its own — an unhandled rejection
// (e.g. a transient DB hiccup) would otherwise crash the whole process and
// take down every in-flight rider/driver, not just the one failed request.
// Log and keep running instead.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[uncaughtException]", err);
});

const app = createApp();
// HTTPS only when the private-LAN-test start script has provided a cert -
// every other dev workflow (pnpm dev:api, start-trylo.bat) leaves these
// unset and gets the exact same plain http.createServer as before.
// initSocketServer() below works identically either way - socket.io accepts
// any Node http-compatible server and upgrades to wss:// automatically when
// given an https.Server.
const useHttps = Boolean(env.HTTPS_CERT_PATH && env.HTTPS_KEY_PATH);
const httpServer = useHttps
  ? createHttpsServer(
      { cert: readFileSync(env.HTTPS_CERT_PATH!), key: readFileSync(env.HTTPS_KEY_PATH!) },
      app
    )
  : createServer(app);
initSocketServer(httpServer);
startMatchingLoop();

// A failure to bind the port (e.g. EADDRINUSE from a stale process still
// holding it) means this process cannot serve traffic at all — that must
// stay fatal. Letting the generic uncaughtException handler above swallow it
// would leave a zombie process that looks alive (still running, still able
// to log) but never actually listens, silently answering nothing.
httpServer.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error(`[fatal] Failed to start server on port ${env.PORT}:`, err);
  process.exit(1);
});

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TRYLO API listening on ${useHttps ? "https" : "http"}://localhost:${env.PORT}`);
});
