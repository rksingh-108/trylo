-- "One active ride per rider" / "one active ride per driver" have always been
-- enforced only by application-level check-then-write logic
-- (customerRide.routes.ts's POST / handler, matcher.ts's offer assignment) -
-- with no database backstop, so a genuine race (double-tap, multiple
-- tabs/devices on one account, two concurrent matching-loop ticks) could
-- create more than one simultaneously-active ride for the same rider or
-- driver. Add partial unique indexes to make that impossible at the DB level,
-- matching the same defense-in-depth already used for driver earnings /
-- wallet transactions (see the @unique rideId columns on those tables).

-- Defensive cleanup first, so this migration applies cleanly even if such a
-- race already happened before this constraint existed: keep only the most
-- recently requested active ride per rider/driver, cancel any older
-- duplicates. A no-op if no such duplicates exist.
WITH ranked_by_rider AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "riderId" ORDER BY "requestedAt" DESC) AS rn
  FROM "Ride"
  WHERE status IN ('requested', 'matched', 'arriving', 'arrived', 'in_progress')
)
UPDATE "Ride"
SET status = 'cancelled',
    "cancelledAt" = now(),
    "cancelReason" = 'Duplicate active ride cleaned up by migration',
    "cancelledBy" = 'admin'
WHERE id IN (SELECT id FROM ranked_by_rider WHERE rn > 1);

WITH ranked_by_driver AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "driverId" ORDER BY "requestedAt" DESC) AS rn
  FROM "Ride"
  WHERE status IN ('requested', 'matched', 'arriving', 'arrived', 'in_progress')
    AND "driverId" IS NOT NULL
)
UPDATE "Ride"
SET status = 'cancelled',
    "cancelledAt" = now(),
    "cancelReason" = 'Duplicate active ride cleaned up by migration',
    "cancelledBy" = 'admin'
WHERE id IN (SELECT id FROM ranked_by_driver WHERE rn > 1);

-- CreateIndex
CREATE UNIQUE INDEX "Ride_one_active_per_rider" ON "Ride"("riderId")
  WHERE status IN ('requested', 'matched', 'arriving', 'arrived', 'in_progress');

-- CreateIndex
CREATE UNIQUE INDEX "Ride_one_active_per_driver" ON "Ride"("driverId")
  WHERE status IN ('requested', 'matched', 'arriving', 'arrived', 'in_progress') AND "driverId" IS NOT NULL;
