import type { Server as HttpServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { env } from "../env";
import { verifyToken, type Role } from "../auth/jwt";
import { db } from "../db";

let io: SocketIOServer | null = null;

// Debounce driver auto-offline: a brief reconnect (tab refresh, network blip)
// shouldn't flip a driver offline mid-shift. Counts active sockets per driver;
// only marks offline if the count is still zero after a short grace window.
const driverConnectionCounts = new Map<string, number>();
const OFFLINE_GRACE_MS = 6_000;

interface SocketAuth {
  id: string;
  role: Role;
}

function getAuth(socket: Socket): SocketAuth | undefined {
  return socket.data.auth as SocketAuth | undefined;
}

/**
 * Rooms: `ride:{rideId}` (joined by the rider and the assigned driver, receives `ride:updated`)
 * and `driver:{driverId}` (receives `incoming_request` / `request_cleared`). Clients join by
 * emitting `join:ride` / `join:driver` after connecting — see packages/mock-data/src/socketClient.ts.
 * Every socket must authenticate on connect with the same JWT used for REST calls; joins are
 * restricted to rooms the authenticated identity actually owns.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigins },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.auth = { id: payload.sub, role: payload.role } satisfies SocketAuth;
    next();
  });

  io.on("connection", (socket) => {
    const auth = getAuth(socket)!;

    if (auth.role === "driver") {
      driverConnectionCounts.set(auth.id, (driverConnectionCounts.get(auth.id) ?? 0) + 1);
    }

    socket.on("join:ride", async (rideId: string) => {
      if (typeof rideId !== "string") return;
      const ride = await db.ride.findUnique({ where: { id: rideId }, select: { riderId: true, driverId: true } });
      if (!ride) return;
      const owns = (auth.role === "customer" && ride.riderId === auth.id) || (auth.role === "driver" && ride.driverId === auth.id);
      if (owns) socket.join(`ride:${rideId}`);
    });

    socket.on("leave:ride", (rideId: string) => {
      if (typeof rideId === "string") socket.leave(`ride:${rideId}`);
    });

    socket.on("join:driver", (driverId: string) => {
      if (typeof driverId === "string" && auth.role === "driver" && auth.id === driverId) {
        socket.join(`driver:${driverId}`);
      }
    });

    socket.on("disconnect", () => {
      if (auth.role !== "driver") return;
      const remaining = Math.max(0, (driverConnectionCounts.get(auth.id) ?? 1) - 1);
      driverConnectionCounts.set(auth.id, remaining);

      if (remaining === 0) {
        setTimeout(async () => {
          if ((driverConnectionCounts.get(auth.id) ?? 0) > 0) return; // reconnected within the grace window
          try {
            await db.driver.update({ where: { id: auth.id }, data: { isOnline: false } });
          } catch {
            // driver row may not exist in edge cases (e.g. deleted) — nothing to do
          }
        }, OFFLINE_GRACE_MS);
      }
    });
  });

  return io;
}

export function emitRideUpdated(rideId: string, ride: unknown) {
  io?.to(`ride:${rideId}`).emit("ride:updated", ride);
}

export function emitIncomingRequest(driverId: string, offer: unknown) {
  io?.to(`driver:${driverId}`).emit("incoming_request", offer);
}

export function emitRequestCleared(driverId: string) {
  io?.to(`driver:${driverId}`).emit("request_cleared");
}
