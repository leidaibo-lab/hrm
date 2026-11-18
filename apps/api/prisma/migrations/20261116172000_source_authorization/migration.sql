-- CreateTable
CREATE TABLE "agentic_source_authorizations" (
    "id" TEXT NOT NULL,
    "sourceInstanceId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "authorizedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agentic_source_authorizations_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "agentic_source_authorizations_sourceInstanceId_idx" ON "agentic_source_authorizations"("sourceInstanceId");
-- CreateIndex
CREATE INDEX "agentic_source_authorizations_expiresAt_idx" ON "agentic_source_authorizations"("expiresAt");
-- CreateIndex
CREATE UNIQUE INDEX "agentic_source_authorizations_sourceInstanceId_scopeKey_key" ON "agentic_source_authorizations"("sourceInstanceId", "scopeKey");
-- AddForeignKey
ALTER TABLE "agentic_source_authorizations" ADD CONSTRAINT "agentic_source_authorizations_sourceInstanceId_fkey" FOREIGN KEY ("sourceInstanceId") REFERENCES "agentic_source_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
