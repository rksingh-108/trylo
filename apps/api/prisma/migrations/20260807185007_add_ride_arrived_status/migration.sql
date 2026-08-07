-- AlterEnum
ALTER TYPE "RideStatus" ADD VALUE 'arrived';

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "arrivedAt" TIMESTAMP(3);
