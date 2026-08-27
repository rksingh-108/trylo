-- Lets a driver pick a purely cosmetic live-map marker skin for themselves,
-- independent of their VehicleType (which still always determines the icon
-- shown inside the marker - see driverRide.routes.ts and premium-map.tsx's
-- liveDotHtml).

-- CreateEnum
CREATE TYPE "MarkerStyle" AS ENUM ('classic', 'arrow', 'beacon', 'compact');

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN "markerStyle" "MarkerStyle" NOT NULL DEFAULT 'classic';
