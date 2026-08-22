-- AlterEnum
ALTER TYPE "WalletTxnCategory" ADD VALUE 'cancellation_fee';

-- CreateTable
CREATE TABLE "RideMessage" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "senderRole" "OwnerRole" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosAlert" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "triggeredBy" "OwnerRole" NOT NULL,
    "riderId" TEXT NOT NULL,
    "driverId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SosAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RideMessage_rideId_createdAt_idx" ON "RideMessage"("rideId", "createdAt");

-- CreateIndex
CREATE INDEX "SosAlert_rideId_idx" ON "SosAlert"("rideId");

-- CreateIndex
CREATE INDEX "SosAlert_createdAt_idx" ON "SosAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "RideMessage" ADD CONSTRAINT "RideMessage_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosAlert" ADD CONSTRAINT "SosAlert_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
