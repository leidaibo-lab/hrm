-- DropForeignKey
ALTER TABLE "agentic_artifacts" DROP CONSTRAINT "agentic_artifacts_assignmentId_fkey";
-- AlterTable
ALTER TABLE "agentic_source_health" ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- AddForeignKey
ALTER TABLE "agentic_artifacts" ADD CONSTRAINT "agentic_artifacts_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "agentic_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
