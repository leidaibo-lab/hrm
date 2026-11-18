-- 存量回填：等待对象回落到工单授权发起人；时限回落到创建时间 + 72 小时。
UPDATE "agentic_attentions" AS a
SET "assignee" = m."actorId"
FROM "agentic_tickets" AS t
JOIN "agentic_mandates" AS m ON m."id" = t."mandateId"
WHERE a."ticketId" = t."id" AND a."assignee" IS NULL;

UPDATE "agentic_attentions"
SET "deadline" = "createdAt" + INTERVAL '72 hours'
WHERE "deadline" IS NULL;

-- I9：等待对象与时限必填，空值写入由数据库拒绝。
ALTER TABLE "agentic_attentions" ALTER COLUMN "assignee" SET NOT NULL;
ALTER TABLE "agentic_attentions" ALTER COLUMN "deadline" SET NOT NULL;
