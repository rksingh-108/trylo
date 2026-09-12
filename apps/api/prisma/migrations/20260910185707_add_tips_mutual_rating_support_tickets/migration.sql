-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('open', 'resolved');

-- AlterEnum
ALTER TYPE "WalletTxnCategory" ADD VALUE 'tip';

-- AlterTable
ALTER TABLE "DriverEarning" ADD COLUMN     "tip" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "riderRating" INTEGER,
ADD COLUMN     "tipSettledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" "OwnerRole" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_ownerId_ownerRole_idx" ON "SupportTicket"("ownerId", "ownerRole");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
