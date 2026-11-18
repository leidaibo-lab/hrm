-- CreateEnum
CREATE TYPE "agentic_source_type" AS ENUM ('lark', 'zentao', 'gitlab');

-- CreateEnum
CREATE TYPE "agentic_addressed" AS ENUM ('mention', 'direct');

-- CreateEnum
CREATE TYPE "agentic_disposition" AS ENUM ('pending', 'filtered', 'evaluated', 'fanned_out');

-- CreateEnum
CREATE TYPE "agentic_thread_status" AS ENUM ('open', 'dormant', 'closed');

-- CreateEnum
CREATE TYPE "agentic_decision_kind" AS ENUM ('accept', 'stop', 'ignore', 'unavailable');

-- CreateEnum
CREATE TYPE "agentic_mandate_strength" AS ENUM ('explicit', 'inferred');

-- CreateEnum
CREATE TYPE "agentic_ticket_kind" AS ENUM ('requirement', 'bug', 'release');

-- CreateEnum
CREATE TYPE "agentic_ticket_status" AS ENUM ('open', 'ended');

-- CreateEnum
CREATE TYPE "agentic_assignment_status" AS ENUM ('pending', 'running', 'ended');

-- CreateEnum
CREATE TYPE "agentic_subscription_reason" AS ENUM ('started', 'pull_request', 'context');

-- CreateEnum
CREATE TYPE "agentic_attention_kind" AS ENUM ('confirm', 'clarify', 'review', 'approval');

-- CreateEnum
CREATE TYPE "agentic_attention_status" AS ENUM ('open', 'answered', 'expired');

-- CreateEnum
CREATE TYPE "agentic_artifact_kind" AS ENUM ('clarify', 'breakdown', 'analysis', 'report');

-- CreateEnum
CREATE TYPE "agentic_artifact_status" AS ENUM ('draft', 'confirmed', 'superseded');

-- CreateEnum
CREATE TYPE "agentic_admission_cell" AS ENUM ('listed_unaddressed', 'unlisted_addressed', 'unlisted_unaddressed');

-- CreateEnum
CREATE TYPE "agentic_outbound_status" AS ENUM ('pending', 'sent', 'gone');

-- CreateTable
CREATE TABLE "agentic_threads" (
    "id" TEXT NOT NULL,
    "sourceType" "agentic_source_type" NOT NULL,
    "externalKey" TEXT NOT NULL,
    "scopeKey" TEXT,
    "status" "agentic_thread_status" NOT NULL DEFAULT 'open',
    "summary" TEXT,
    "summaryVersion" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agentic_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_triggers" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sourceType" "agentic_source_type" NOT NULL,
    "instanceId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "scopeKey" TEXT,
    "actorId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "addressed" "agentic_addressed",
    "text" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disposition" "agentic_disposition" NOT NULL DEFAULT 'pending',
    "disposedAt" TIMESTAMPTZ(3),

    CONSTRAINT "agentic_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_reply_targets" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sourceType" "agentic_source_type" NOT NULL,
    "addressKey" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_reply_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_policies" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "acceptMode" "agentic_mandate_strength" NOT NULL DEFAULT 'explicit',
    "rules" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_admission_rules" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "sourceInstanceId" TEXT NOT NULL,
    "scopeRow" TEXT NOT NULL,
    "cell" "agentic_admission_cell" NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_admission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_decisions" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" "agentic_decision_kind" NOT NULL,
    "strength" "agentic_mandate_strength" NOT NULL,
    "scope" JSONB NOT NULL,
    "matchedRuleIds" JSONB,
    "policyId" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_decision_triggers" (
    "decisionId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,

    CONSTRAINT "agentic_decision_triggers_pkey" PRIMARY KEY ("decisionId","triggerId")
);

-- CreateTable
CREATE TABLE "agentic_mandates" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "strength" "agentic_mandate_strength" NOT NULL,
    "scope" JSONB NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "sourceType" "agentic_source_type" NOT NULL,
    "matchedRules" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_tickets" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "scopeKey" TEXT,
    "kind" "agentic_ticket_kind" NOT NULL,
    "status" "agentic_ticket_status" NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "endReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agentic_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_assignments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "status" "agentic_assignment_status" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "executorRunId" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agentic_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_subscriptions" (
    "ticketId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "reason" "agentic_subscription_reason" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_subscriptions_pkey" PRIMARY KEY ("ticketId","threadId")
);

-- CreateTable
CREATE TABLE "agentic_attentions" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" "agentic_attention_kind" NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "status" "agentic_attention_status" NOT NULL DEFAULT 'open',
    "deadline" TIMESTAMPTZ(3),
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "answer" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agentic_attentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_artifacts" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" "agentic_artifact_kind" NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "agentic_artifact_status" NOT NULL DEFAULT 'draft',
    "assignmentId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_source_instances" (
    "id" TEXT NOT NULL,
    "sourceType" "agentic_source_type" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "botId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agentic_source_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentic_source_cursors" (
    "instanceId" TEXT NOT NULL,
    "cursor" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agentic_source_cursors_pkey" PRIMARY KEY ("instanceId")
);

-- CreateTable
CREATE TABLE "agentic_outbound_messages" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "targetId" TEXT,
    "address" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "agentic_outbound_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agentic_outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agentic_threads_status_lastEventAt_idx" ON "agentic_threads"("status", "lastEventAt");

-- CreateIndex
CREATE INDEX "agentic_threads_scopeKey_status_idx" ON "agentic_threads"("scopeKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_threads_sourceType_externalKey_key" ON "agentic_threads"("sourceType", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_triggers_dedupeKey_key" ON "agentic_triggers"("dedupeKey");

-- CreateIndex
CREATE INDEX "agentic_triggers_threadId_occurredAt_idx" ON "agentic_triggers"("threadId", "occurredAt");

-- CreateIndex
CREATE INDEX "agentic_triggers_sourceType_occurredAt_idx" ON "agentic_triggers"("sourceType", "occurredAt");

-- CreateIndex
CREATE INDEX "agentic_triggers_scopeKey_disposition_idx" ON "agentic_triggers"("scopeKey", "disposition");

-- CreateIndex
CREATE INDEX "agentic_triggers_instanceId_idx" ON "agentic_triggers"("instanceId");

-- CreateIndex
CREATE INDEX "agentic_reply_targets_sourceType_idx" ON "agentic_reply_targets"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_reply_targets_threadId_addressKey_key" ON "agentic_reply_targets"("threadId", "addressKey");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_policies_version_key" ON "agentic_policies"("version");

-- CreateIndex
CREATE INDEX "agentic_policies_createdAt_idx" ON "agentic_policies"("createdAt");

-- CreateIndex
CREATE INDEX "agentic_admission_rules_sourceInstanceId_scopeRow_idx" ON "agentic_admission_rules"("sourceInstanceId", "scopeRow");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_admission_rules_policyId_sourceInstanceId_scopeRow__key" ON "agentic_admission_rules"("policyId", "sourceInstanceId", "scopeRow", "cell");

-- CreateIndex
CREATE INDEX "agentic_decisions_threadId_createdAt_idx" ON "agentic_decisions"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "agentic_decisions_kind_createdAt_idx" ON "agentic_decisions"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "agentic_decision_triggers_triggerId_idx" ON "agentic_decision_triggers"("triggerId");

-- CreateIndex
CREATE INDEX "agentic_mandates_actorUserId_createdAt_idx" ON "agentic_mandates"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "agentic_mandates_policyId_idx" ON "agentic_mandates"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_tickets_mandateId_key" ON "agentic_tickets"("mandateId");

-- CreateIndex
CREATE INDEX "agentic_tickets_threadId_status_idx" ON "agentic_tickets"("threadId", "status");

-- CreateIndex
CREATE INDEX "agentic_tickets_status_openedAt_idx" ON "agentic_tickets"("status", "openedAt");

-- CreateIndex
CREATE INDEX "agentic_tickets_scopeKey_status_idx" ON "agentic_tickets"("scopeKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_assignments_executorRunId_key" ON "agentic_assignments"("executorRunId");

-- CreateIndex
CREATE INDEX "agentic_assignments_ticketId_status_idx" ON "agentic_assignments"("ticketId", "status");

-- CreateIndex
CREATE INDEX "agentic_assignments_status_updatedAt_idx" ON "agentic_assignments"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "agentic_subscriptions_threadId_idx" ON "agentic_subscriptions"("threadId");

-- CreateIndex
CREATE INDEX "agentic_attentions_status_deadline_idx" ON "agentic_attentions"("status", "deadline");

-- CreateIndex
CREATE INDEX "agentic_attentions_ticketId_status_idx" ON "agentic_attentions"("ticketId", "status");

-- CreateIndex
CREATE INDEX "agentic_artifacts_ticketId_createdAt_idx" ON "agentic_artifacts"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "agentic_artifacts_assignmentId_idx" ON "agentic_artifacts"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_artifacts_ticketId_kind_version_key" ON "agentic_artifacts"("ticketId", "kind", "version");

-- CreateIndex
CREATE INDEX "agentic_source_instances_enabled_idx" ON "agentic_source_instances"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_source_instances_sourceType_name_key" ON "agentic_source_instances"("sourceType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "agentic_outbound_messages_idempotencyKey_key" ON "agentic_outbound_messages"("idempotencyKey");

-- CreateIndex
CREATE INDEX "agentic_outbound_messages_status_nextAttemptAt_idx" ON "agentic_outbound_messages"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "agentic_outbound_messages_instanceId_createdAt_idx" ON "agentic_outbound_messages"("instanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "agentic_triggers" ADD CONSTRAINT "agentic_triggers_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "agentic_source_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_triggers" ADD CONSTRAINT "agentic_triggers_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agentic_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_reply_targets" ADD CONSTRAINT "agentic_reply_targets_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agentic_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_admission_rules" ADD CONSTRAINT "agentic_admission_rules_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "agentic_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_admission_rules" ADD CONSTRAINT "agentic_admission_rules_sourceInstanceId_fkey" FOREIGN KEY ("sourceInstanceId") REFERENCES "agentic_source_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_decisions" ADD CONSTRAINT "agentic_decisions_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agentic_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_decisions" ADD CONSTRAINT "agentic_decisions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "agentic_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_decision_triggers" ADD CONSTRAINT "agentic_decision_triggers_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "agentic_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_decision_triggers" ADD CONSTRAINT "agentic_decision_triggers_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "agentic_triggers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_mandates" ADD CONSTRAINT "agentic_mandates_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "agentic_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_tickets" ADD CONSTRAINT "agentic_tickets_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "agentic_mandates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_tickets" ADD CONSTRAINT "agentic_tickets_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agentic_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_assignments" ADD CONSTRAINT "agentic_assignments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "agentic_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_subscriptions" ADD CONSTRAINT "agentic_subscriptions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "agentic_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_subscriptions" ADD CONSTRAINT "agentic_subscriptions_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agentic_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_attentions" ADD CONSTRAINT "agentic_attentions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "agentic_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_artifacts" ADD CONSTRAINT "agentic_artifacts_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "agentic_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_artifacts" ADD CONSTRAINT "agentic_artifacts_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "agentic_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_source_cursors" ADD CONSTRAINT "agentic_source_cursors_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "agentic_source_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentic_outbound_messages" ADD CONSTRAINT "agentic_outbound_messages_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "agentic_source_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
