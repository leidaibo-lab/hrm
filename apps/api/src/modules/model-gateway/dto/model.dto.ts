import { defaultModelParamsSchema, modelCapabilitiesSchema } from '@cip/shared';
import { z } from 'zod';

/** 逻辑模型写入 schema：logicalKey 唯一且不可变。 */
export const createLogicalModelSchema = z.object({
  logicalKey: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'logicalKey 只能是小写 kebab-case'),
  displayName: z.string().min(1).max(100),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

export type CreateLogicalModelDto = z.infer<typeof createLogicalModelSchema>;

export const updateLogicalModelSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

export type UpdateLogicalModelDto = z.infer<typeof updateLogicalModelSchema>;

export const setLogicalModelEnabledSchema = z.object({ enabled: z.boolean() });

export type SetLogicalModelEnabledDto = z.infer<
  typeof setLogicalModelEnabledSchema
>;

export const logicalModelViewSchema = z.object({
  id: z.string(),
  logicalKey: z.string(),
  displayName: z.string(),
  enabled: z.boolean(),
  maxAttempts: z.number().int(),
  createdAt: z.string(),
});

export type LogicalModelViewDto = z.infer<typeof logicalModelViewSchema>;

/** 候选写入 schema：能力事实落候选，priority 升序决定链序。 */
export const createCandidateSchema = z.object({
  providerId: z.string().min(1),
  providerModelId: z.string().min(1).max(200),
  catalogModelId: z.string().min(1).max(200).nullable().optional(),
  priority: z.number().int().min(0).max(10_000),
  timeoutMs: z.number().int().positive().max(600_000).nullable().optional(),
  capabilities: modelCapabilitiesSchema,
  defaultParams: defaultModelParamsSchema.nullable().optional(),
});

export type CreateCandidateDto = z.infer<typeof createCandidateSchema>;

export const updateCandidateSchema = z.object({
  providerModelId: z.string().min(1).max(200).optional(),
  catalogModelId: z.string().min(1).max(200).nullable().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  timeoutMs: z.number().int().positive().max(600_000).nullable().optional(),
  capabilities: modelCapabilitiesSchema.optional(),
  defaultParams: defaultModelParamsSchema.nullable().optional(),
});

export type UpdateCandidateDto = z.infer<typeof updateCandidateSchema>;

export const setCandidateEnabledSchema = z.object({ enabled: z.boolean() });

export type SetCandidateEnabledDto = z.infer<typeof setCandidateEnabledSchema>;

export const candidateViewSchema = z.object({
  id: z.string(),
  logicalModelId: z.string(),
  providerId: z.string(),
  providerModelId: z.string(),
  catalogModelId: z.string().nullable(),
  priority: z.number().int(),
  enabled: z.boolean(),
  timeoutMs: z.number().int().nullable(),
  capabilities: modelCapabilitiesSchema,
  defaultParams: defaultModelParamsSchema.nullable(),
  createdAt: z.string(),
});

export type CandidateViewDto = z.infer<typeof candidateViewSchema>;
