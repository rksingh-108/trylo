import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./env";
import { initSocketServer } from "./realtime/io";
import { startMatchingLoop } from "./matching/matcher";

const app = createApp();
const httpServer = createServer(app);
initSocketServer(httpServer);
startMatchingLoop();

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TRYLO API listening on http://localhost:${env.PORT}`);
});
