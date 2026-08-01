import { io, type Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
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
