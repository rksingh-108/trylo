import { io, type Socket } from "socket.io-client";
import { getToken } from "./tokenStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      // Function form so the *current* access token is sent on every connect
      // and reconnect attempt, not just whatever was valid when the socket
      // was first created (the access token is short-lived and rotates via
      // the apiClient's silent refresh — see apiClient.ts).
      auth: (cb) => cb({ token: getToken() }),
    });
  } else if (!socket.connected) {
    // A prior connection attempt may have been rejected (e.g. no token yet
    // at first page load, before login). Re-trigger with the latest token.
    socket.connect();
  }
  return socket;
}

export function joinRideRoom(rideId: string) {
  getSocket()?.emit("join:ride", rideId);
}

export function leaveRideRoom(rideId: string) {
  getSocket()?.emit("leave:ride", rideId);
}

export function joinDriverRoom(driverId: string) {
  getSocket()?.emit("join:driver", driverId);
}

export function onRideUpdated<T = unknown>(handler: (ride: T) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("ride:updated", handler);
  return () => s.off("ride:updated", handler);
}

export function onIncomingRequest<T = unknown>(handler: (offer: T) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("incoming_request", handler);
  return () => s.off("incoming_request", handler);
}

export function onRequestCleared(handler: () => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("request_cleared", handler);
  return () => s.off("request_cleared", handler);
}

export function onDriverLocation<T = unknown>(handler: (location: T) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("driver:location", handler);
  return () => s.off("driver:location", handler);
}

/** Sends an in-ride chat message. Delivered live via `ride:message:new` to everyone in the `ride:{rideId}` room (see apps/api/src/realtime/io.ts). */
export function sendRideMessage(rideId: string, body: string) {
  getSocket()?.emit("ride:message", { rideId, body });
}

export function onRideMessage<T = unknown>(handler: (message: T) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("ride:message:new", handler);
  return () => s.off("ride:message:new", handler);
}

/** A notification pushed live to whichever side it's addressed to - filter by `forRole` before acting on it, since both the rider's and driver's sockets share the same ride room. */
export function onNotification<T = unknown>(handler: (notification: T & { forRole: "customer" | "driver" }) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("notification:new", handler);
  return () => s.off("notification:new", handler);
}
