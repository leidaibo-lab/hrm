-- CreateEnum
CREATE TYPE "agentic_effect_kind" AS ENUM ('create_issue', 'send_card', 'update_status');

-- CreateEnum
CREATE TYPE "agentic_effect_status" AS ENUM ('pending', 'succeeded', 'failed', 'gone');

-- CreateEnum
CREATE TYPE "agentic_report_kind" AS ENUM ('progress', 'waiting', 'ready', 'blocked', 'failed');

-- CreateEnum
CREATE TYPE "agentic_health_state" AS ENUM ('starting', 'ready', 'error', 'paused');

-- CreateTable
CREATE TABLE "agentic_effects" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" "agentic_effect_kind" NOT NULL,
    "target" TEXT NOT NULL,
    "status" "agentic_effect_status" NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "agentic_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_reports" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "kind" "agentic_report_kind" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_source_health" (
    "instanceId" TEXT NOT NULL,
    "entry" TEXT NOT NULL,
    "state" "agentic_health_state" NOT NULL DEFAULT 'starting',
    "detail" TEXT,
    "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_source_health_pkey" PRIMARY KEY ("instanceId","entry")
);

-- CreateTable
CREATE TABLE "agentic_agent_versions" (
    "id" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "promptDigest" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agentic_effects_idempotencyKey_key" ON "agentic_effects"("idempotencyKey");

-- CreateIndex
CREATE INDEX "agentic_effects_status_createdAt_idx" ON "agentic_effects"("status", "createdAt");

-- CreateIndex
CREATE INDEX "agentic_reports_assignmentId_createdAt_idx" ON "agentic_reports"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "agentic_source_health_state_checkedAt_idx" ON "agentic_source_health"("state", "checkedAt");

-- CreateIndex
CREATE INDEX "agentic_agent_versions_agentKey_createdAt_idx" ON "agentic_agent_versions"("agentKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_agent_versions_agentKey_version_key" ON "agentic_agent_versions"("agentKey", "version");

-- AddForeignKey
ALTER TABLE "agentic_reports" ADD CONSTRAINT "agentic_reports_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "agentic_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_source_health" ADD CONSTRAINT "agentic_source_health_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "agentic_source_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
