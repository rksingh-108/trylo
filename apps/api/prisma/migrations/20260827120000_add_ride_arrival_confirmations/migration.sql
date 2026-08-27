-- A single noisy GPS fix could previously commit "arrived" on its own -
-- consumer GPS error is commonly comparable to or larger than
-- ARRIVAL_RADIUS_METERS (50m) in urban/indoor-adjacent conditions, so a
-- driver could be marked arrived while genuinely still meaningfully far from
-- pickup. This column tracks consecutive trustworthy (good-accuracy),
-- within-radius pings while "arriving" - arrival is now only committed once
-- a small number of them agree, not a single reading (see driverRide.
-- routes.ts's POST /location).

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN "arrivalConfirmations" INTEGER NOT NULL DEFAULT 0;
