-- CreateEnum
CREATE TYPE "model_gateway_protocol" AS ENUM ('openai_compatible');

-- CreateEnum
CREATE TYPE "model_gateway_health" AS ENUM ('healthy', 'degraded');

-- CreateEnum
CREATE TYPE "model_gateway_price_source" AS ENUM ('manual', 'models_dev');

-- CreateEnum
CREATE TYPE "model_gateway_usage_price_source" AS ENUM ('manual', 'models_dev', 'missing');

-- CreateEnum
CREATE TYPE "model_gateway_usage_status" AS ENUM ('success', 'failed', 'rate_limited', 'cancelled');

-- CreateEnum
CREATE TYPE "model_gateway_catalog_sync_status" AS ENUM ('success', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "model_gateway_fx_source" AS ENUM ('manual');

-- CreateTable
CREATE TABLE "model_gateway_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "protocol" "model_gateway_protocol" NOT NULL DEFAULT 'openai_compatible',
    "base_url" TEXT NOT NULL,
    "api_key_cipher" TEXT NOT NULL,
    "catalog_provider_id" TEXT,
    "timeout_ms" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "health" "model_gateway_health" NOT NULL DEFAULT 'healthy',
    "open_until" TIMESTAMPTZ(3),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "rate_limit_per_minute" INTEGER,
    "max_concurrent" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "model_gateway_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_gateway_logical_models" (
    "id" TEXT NOT NULL,
    "logical_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "model_gateway_logical_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_gateway_candidates" (
    "id" TEXT NOT NULL,
    "logical_model_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "provider_model_id" TEXT NOT NULL,
    "catalog_model_id" TEXT,
    "priority" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timeout_ms" INTEGER,
    "capabilities" JSONB NOT NULL,
    "default_params" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "model_gateway_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_gateway_prices" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "source" "model_gateway_price_source" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "input" DECIMAL(18,8) NOT NULL,
    "output" DECIMAL(18,8) NOT NULL,
    "cache_read" DECIMAL(18,8),
    "cache_write" DECIMAL(18,8),
    "reasoning" DECIMAL(18,8),
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "fetched_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_gateway_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_gateway_fx_rates" (
    "id" TEXT NOT NULL,
    "base_currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "quote_currency" CHAR(3) NOT NULL,
    "rate_to_base" DECIMAL(18,8) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "source" "model_gateway_fx_source" NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_gateway_fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_gateway_usages" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "trace_id" TEXT,
    "caller" TEXT,
    "logical_model_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "space_id" TEXT,
    "agent_key" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "reasoning_tokens" INTEGER NOT NULL DEFAULT 0,
    "price_id" TEXT,
    "price_source" "model_gateway_usage_price_source" NOT NULL,
    "currency" CHAR(3),
    "cost_original" DECIMAL(18,8),
    "cost" DECIMAL(18,8),
    "fx_rate" DECIMAL(18,8),
    "fx_rate_id" TEXT,
    "fx_missing" BOOLEAN NOT NULL DEFAULT false,
    "status" "model_gateway_usage_status" NOT NULL,
    "error_code" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_gateway_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_gateway_catalog_syncs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "status" "model_gateway_catalog_sync_status" NOT NULL,
    "providers" INTEGER NOT NULL DEFAULT 0,
    "models" INTEGER NOT NULL DEFAULT 0,
    "prices_written" INTEGER NOT NULL DEFAULT 0,
    "unmatched" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_gateway_catalog_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_gateway_providers_slug_key" ON "model_gateway_providers"("slug");

-- CreateIndex
CREATE INDEX "model_gateway_providers_enabled_health_idx" ON "model_gateway_providers"("enabled", "health");

-- CreateIndex
CREATE UNIQUE INDEX "model_gateway_logical_models_logical_key_key" ON "model_gateway_logical_models"("logical_key");

-- CreateIndex
CREATE INDEX "model_gateway_candidates_logical_model_id_enabled_priority_idx" ON "model_gateway_candidates"("logical_model_id", "enabled", "priority");

-- CreateIndex
CREATE INDEX "model_gateway_candidates_provider_id_idx" ON "model_gateway_candidates"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "model_gateway_candidates_logical_model_id_provider_id_provi_key" ON "model_gateway_candidates"("logical_model_id", "provider_id", "provider_model_id");

-- CreateIndex
CREATE INDEX "model_gateway_prices_candidate_id_source_effective_from_idx" ON "model_gateway_prices"("candidate_id", "source", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "model_gateway_prices_candidate_id_source_effective_from_key" ON "model_gateway_prices"("candidate_id", "source", "effective_from");

-- CreateIndex
CREATE INDEX "model_gateway_fx_rates_base_currency_quote_currency_effecti_idx" ON "model_gateway_fx_rates"("base_currency", "quote_currency", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "model_gateway_fx_rates_base_currency_quote_currency_effecti_key" ON "model_gateway_fx_rates"("base_currency", "quote_currency", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "model_gateway_usages_call_id_key" ON "model_gateway_usages"("call_id");

-- CreateIndex
CREATE INDEX "model_gateway_usages_space_id_created_at_idx" ON "model_gateway_usages"("space_id", "created_at");

-- CreateIndex
CREATE INDEX "model_gateway_usages_candidate_id_created_at_idx" ON "model_gateway_usages"("candidate_id", "created_at");

-- CreateIndex
CREATE INDEX "model_gateway_usages_trace_id_idx" ON "model_gateway_usages"("trace_id");

-- AddForeignKey
ALTER TABLE "model_gateway_candidates" ADD CONSTRAINT "model_gateway_candidates_logical_model_id_fkey" FOREIGN KEY ("logical_model_id") REFERENCES "model_gateway_logical_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_gateway_candidates" ADD CONSTRAINT "model_gateway_candidates_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "model_gateway_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_gateway_prices" ADD CONSTRAINT "model_gateway_prices_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "model_gateway_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_gateway_usages" ADD CONSTRAINT "model_gateway_usages_logical_model_id_fkey" FOREIGN KEY ("logical_model_id") REFERENCES "model_gateway_logical_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_gateway_usages" ADD CONSTRAINT "model_gateway_usages_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "model_gateway_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_gateway_usages" ADD CONSTRAINT "model_gateway_usages_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "model_gateway_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_gateway_usages" ADD CONSTRAINT "model_gateway_usages_fx_rate_id_fkey" FOREIGN KEY ("fx_rate_id") REFERENCES "model_gateway_fx_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

