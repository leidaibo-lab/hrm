import { z } from 'zod';

/** 策略规则：已知键强类型，其余键透传供扩展。 */
export const policyRulesSchema = z
  .object({
    allowedActors: z.array(z.string().min(1)).optional(),
    allowedUsers: z.array(z.string().min(1)).optional(),
    assessmentModel: z.string().min(1).optional(),
    fastModel: z.string().min(1).optional(),
    mainModel: z.string().min(1).optional(),
    judgeModel: z.string().min(1).optional(),
    clarificationModel: z.string().min(1).optional(),
    writebackFields: z.array(z.string().min(1)).optional(),
    auditRedactFields: z.array(z.string().min(1)).optional(),
    escalationOwner: z.string().min(1).optional(),
    escalationOwnerBySource: z
      .record(z.enum(['lark', 'zentao', 'gitlab']), z.string().min(1))
      .optional(),
    speculationEnabled: z.boolean().optional(),
    runTimeoutMs: z.number().int().min(1_000).max(600_000).optional(),
    runTokenBudget: z.number().int().min(1_000).max(2_000_000).optional(),
    routingRollout: z
      .object({
        enabled: z.boolean().optional(),
        sources: z.array(z.enum(['lark', 'zentao', 'gitlab'])).optional(),
        scopeKeys: z.array(z.string().min(1)).optional(),
        roles: z
          .array(
            z.enum(['router', 'assess', 'clarify', 'breakdown', 'watchdog']),
          )
          .optional(),
        ticketIds: z.array(z.string().min(1)).optional(),
      })
      .optional(),
    routerAgentEnabled: z.boolean().optional(),
    watchdogEnabled: z.boolean().optional(),
    goneNotifyChatId: z.string().min(1).optional(),
    regressionThreshold: z.number().gt(0).max(1).optional(),
    permissionWindow: z
      .object({
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        timezone: z.string().min(1),
        days: z.array(z.number().int().min(1).max(7)).min(1).optional(),
      })
      .optional(),
  })
  .passthrough();

/** 发布策略请求。 */
export const publishPolicySchema = z.object({
  acceptMode: z.enum(['explicit', 'inferred']),
  rules: policyRulesSchema,
});

/** 发布策略请求类型。 */
export type PublishPolicyRequest = z.infer<typeof publishPolicySchema>;

/** 发布准入规则请求。 */
export const publishAdmissionRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        sourceInstanceId: z.string().min(1),
        scopeRow: z.string().min(1),
        cell: z.enum([
          'listed_unaddressed',
          'unlisted_addressed',
          'unlisted_unaddressed',
        ]),
        allowed: z.boolean(),
      }),
    )
    .min(1),
});

/** 发布准入规则请求类型。 */
export type PublishAdmissionRulesRequest = z.infer<
  typeof publishAdmissionRulesSchema
>;
