-- Enable Postgres's built-in cube + earthdistance contrib extensions.
-- PostGIS is not available in this project's postgres:16-alpine image
-- (verified empirically); cube/earthdistance ship with vanilla Postgres
-- and are sufficient for radius/nearest-neighbor candidate discovery -
-- OSRM (frontend-only, unchanged) still computes the real route
-- distance/duration/ETA afterward.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- AlterTable
-- locationUpdatedAt: set whenever lat/lng is written (driver signup, or
-- POST /driver/location); used to exclude stale-location drivers from
-- matching. NULL for existing rows until their next location write - a
-- safe, conservative default (never worse than the previous "no staleness
-- check at all" behavior).
--
-- geo: generated from lat/lng by Postgres itself via earthdistance's
-- ll_to_earth(), so it's kept in sync automatically by the same UPDATE
-- that already writes lat/lng - no extra query, no trigger, no risk of
-- drift between lat/lng and geo. lat/lng remain the source of truth read
-- and written by the application; geo exists purely to be indexed.
ALTER TABLE "Driver"
  ADD COLUMN "locationUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "geo" earth GENERATED ALWAYS AS (ll_to_earth("lat", "lng")) STORED;

-- CreateIndex
-- GiST index backing radius search / distance ordering on geo.
CREATE INDEX "Driver_geo_idx" ON "Driver" USING gist ("geo");

-- CreateIndex
-- Plain B-tree composite backing the non-spatial candidate filters
-- (isOnline/verificationStatus/suspended/vehicleType), which had no index
-- at all before this migration.
CREATE INDEX "Driver_isOnline_verificationStatus_suspended_vehicleType_idx" ON "Driver"("isOnline", "verificationStatus", "suspended", "vehicleType");
