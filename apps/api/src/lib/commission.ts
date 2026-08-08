/**
 * Reporting-only platform commission rate. Purely derived for admin dashboard/
 * analytics — never stored, never touches the wallet debit / DriverEarning
 * write-path in driverRide.routes.ts. A ride's driver still earns the full
 * fareTotal; this is just "what the platform would keep" for display.
 */
export const PLATFORM_COMMISSION_RATE = 0.2;

export function computeCommission(revenue: number): number {
  return Math.round(revenue * PLATFORM_COMMISSION_RATE);
}
