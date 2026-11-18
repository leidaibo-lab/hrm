-- CreateTable
CREATE TABLE "agentic_scope_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agentic_scope_memberships_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "agentic_scope_memberships_userId_idx" ON "agentic_scope_memberships"("userId");
-- CreateIndex
CREATE INDEX "agentic_scope_memberships_scopeKey_idx" ON "agentic_scope_memberships"("scopeKey");
-- CreateIndex
CREATE UNIQUE INDEX "agentic_scope_memberships_userId_scopeKey_key" ON "agentic_scope_memberships"("userId", "scopeKey");
-- AddForeignKey
ALTER TABLE "agentic_scope_memberships" ADD CONSTRAINT "agentic_scope_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
