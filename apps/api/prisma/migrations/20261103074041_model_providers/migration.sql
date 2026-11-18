-- CreateEnum
CREATE TYPE "usage_status" AS ENUM ('success', 'failed', 'rate_limited');

-- CreateTable
CREATE TABLE "model_providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyCipher" TEXT NOT NULL,
    "timeoutMs" INTEGER,
    "rateLimitPerMinute" INTEGER,
    "maxConcurrent" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_models" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "logicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "defaultParams" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "provider_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_pricings" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "input" DECIMAL(18,8) NOT NULL,
    "output" DECIMAL(18,8) NOT NULL,
    "cacheRead" DECIMAL(18,8),
    "cacheWrite" DECIMAL(18,8),
    "reasoning" DECIMAL(18,8),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_usages" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "pricingId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,8),
    "latencyMs" INTEGER,
    "status" "usage_status" NOT NULL,
    "caller" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_providers_slug_key" ON "model_providers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "provider_models_logicalKey_key" ON "provider_models"("logicalKey");

-- CreateIndex
CREATE INDEX "provider_models_providerId_idx" ON "provider_models"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_models_providerId_modelId_key" ON "provider_models"("providerId", "modelId");

-- CreateIndex
CREATE INDEX "model_pricings_modelId_effectiveFrom_idx" ON "model_pricings"("modelId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "model_usages_modelId_createdAt_idx" ON "model_usages"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "model_usages_traceId_idx" ON "model_usages"("traceId");

-- AddForeignKey
ALTER TABLE "provider_models" ADD CONSTRAINT "provider_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "model_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_pricings" ADD CONSTRAINT "model_pricings_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "provider_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_usages" ADD CONSTRAINT "model_usages_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "provider_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_usages" ADD CONSTRAINT "model_usages_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "model_pricings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
