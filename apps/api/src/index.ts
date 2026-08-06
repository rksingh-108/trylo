import { createServer } from "http";
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
const httpServer = createServer(app);
initSocketServer(httpServer);
startMatchingLoop();

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TRYLO API listening on http://localhost:${env.PORT}`);
});
