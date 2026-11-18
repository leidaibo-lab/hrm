-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "model_providers" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "provider_models" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
