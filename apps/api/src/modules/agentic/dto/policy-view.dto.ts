import { z } from 'zod';

/** 策略视图。 */
export const policyViewSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  acceptMode: z.string(),
  rules: z.record(z.string(), z.unknown()),
  createdBy: z.string(),
  createdAt: z.string(),
});

/** 当前策略响应；无策略时省略 policy。 */
export const currentPolicyResponseSchema = z.object({
  policy: policyViewSchema.optional(),
});

/** 准入规则视图。 */
export const admissionRuleViewSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  sourceInstanceId: z.string(),
  scopeRow: z.string(),
  cell: z.string(),
  allowed: z.boolean(),
});

/** 准入规则列表响应。 */
export const admissionRuleListResponseSchema = z.object({
  items: z.array(admissionRuleViewSchema),
});
