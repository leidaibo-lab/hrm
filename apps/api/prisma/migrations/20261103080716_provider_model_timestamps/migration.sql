/*
  Warnings:

  - Added the required column `updatedAt` to the `provider_models` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "provider_models" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
