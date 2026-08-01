import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../env";

let io: SocketIOServer | null = null;

/**
 * Rooms: `ride:{rideId}` (joined by the rider and the assigned driver, receives `ride:updated`)
 * and `driver:{driverId}` (receives `incoming_request` / `request_cleared`). Clients join by
 * emitting `join:ride` / `join:driver` after connecting — see packages/mock-data/src/socketClient.ts.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigins },
  });

  io.on("connection", (socket) => {
    socket.on("join:ride", (rideId: string) => {
      if (typeof rideId === "string") socket.join(`ride:${rideId}`);
    });
    socket.on("leave:ride", (rideId: string) => {
      if (typeof rideId === "string") socket.leave(`ride:${rideId}`);
    });
    socket.on("join:driver", (driverId: string) => {
      if (typeof driverId === "string") socket.join(`driver:${driverId}`);
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
