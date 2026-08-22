import type { RideStatus } from "@prisma/client";

/**
 * Statuses at which a customer can still cancel for free - no driver has
 * committed to the trip yet (either unmatched, or currently holding an
 * un-accepted offer). Anything past this (the driver has accepted and is
 * en route or already waiting) is a "late" cancellation and incurs the fee
 * below. Kept as an explicit, named list (rather than scattering status
 * checks/amounts across route handlers) so the rule is easy to find and
 * tune in one place.
 */
const FREE_CANCEL_STATUSES: readonly RideStatus[] = ["requested"];

/** Flat late-cancellation fee (INR), charged once a driver has committed to the trip. */
export const LATE_CANCELLATION_FEE_INR = 20;

export function isLateCancellation(status: RideStatus): boolean {
  return !FREE_CANCEL_STATUSES.includes(status);
}
