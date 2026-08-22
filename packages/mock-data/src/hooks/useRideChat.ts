"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RideMessage } from "@trylo/types";
import { queryKeys } from "./queryKeys";
import { joinRideRoom, onRideMessage, sendRideMessage } from "../socketClient";

/**
 * In-ride chat for a given ride, shared by both the customer and driver apps -
 * the underlying room/events are identical for both sides (see
 * apps/api/src/realtime/io.ts's `ride:message` handler), only which REST
 * endpoint fetches history differs, so that's passed in by the caller
 * (ride.service.ts's getRideMessages vs driverRide.service.ts's getRideMessages).
 *
 * Reuses the same `ride:{rideId}` room that useRideStatus/useActiveDriverRide
 * already join for `ride:updated` - joining again here is a harmless no-op if
 * that's already happened.
 */
export function useRideChat(rideId: string | null, fetchHistory: (rideId: string) => Promise<RideMessage[]>) {
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: queryKeys.rideMessages(rideId ?? "none"),
    queryFn: () => fetchHistory(rideId!),
    enabled: Boolean(rideId),
  });

  React.useEffect(() => {
    if (!rideId) return;
    joinRideRoom(rideId);
    const unsubscribe = onRideMessage<RideMessage>((message) => {
      if (message.rideId !== rideId) return;
      queryClient.setQueryData<RideMessage[]>(queryKeys.rideMessages(rideId), (prev) =>
        prev ? [...prev, message] : [message]
      );
    });
    return () => unsubscribe();
  }, [rideId, queryClient]);

  const send = React.useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!rideId || !trimmed) return;
      sendRideMessage(rideId, trimmed);
    },
    [rideId]
  );

  return { messages: historyQuery.data ?? [], isLoading: historyQuery.isLoading, send };
}
