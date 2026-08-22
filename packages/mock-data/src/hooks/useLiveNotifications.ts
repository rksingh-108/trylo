"use client";

import * as React from "react";
import type { AppNotification } from "@trylo/types";
import { onNotification } from "../socketClient";

type LiveNotification = AppNotification & { forRole: "customer" | "driver" };

/**
 * Subscribes to live `notification:new` pushes for a ride (see
 * apps/api/src/realtime/io.ts's emitNotificationToRide) and invokes `onReceive`
 * only for the ones addressed to `role` - both the customer's and driver's
 * sockets share the same ride room, so every push arrives at both, tagged
 * with `forRole`.
 *
 * Deliberately UI-agnostic (no toast call here) - this package has no
 * dependency on @trylo/ui, so the caller decides how to surface it (e.g.
 * `toast.info(n.title, { description: n.body })`).
 */
export function useLiveNotifications(
  rideId: string | null,
  role: "customer" | "driver",
  onReceive: (notification: AppNotification) => void
) {
  const onReceiveRef = React.useRef(onReceive);
  onReceiveRef.current = onReceive;

  React.useEffect(() => {
    if (!rideId) return;
    const unsubscribe = onNotification<LiveNotification>((notification) => {
      if (notification.forRole !== role) return;
      const { forRole: _forRole, ...rest } = notification;
      onReceiveRef.current(rest);
    });
    return () => unsubscribe();
  }, [rideId, role]);
}
