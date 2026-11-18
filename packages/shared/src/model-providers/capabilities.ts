import { z } from 'zod';

/**
 * 模型能力声明（ADR-0015）：管理面录入，ProviderModel.capabilities 的存储 schema。
 * 用途：请求前置校验（能力不满足直接拒绝）、按能力筛模型、前端展示。
 * api 与 web 共用同一 schema：录入与展示不出现两套语义。
 */
export const modelCapabilitiesSchema = z.object({
  /** 上下文窗口（token 上限）。 */
  contextWindow: z.number().int().positive(),
  /** 单次输出上限（token）。 */
  maxOutputTokens: z.number().int().positive(),
  /** 支持函数调用。 */
  toolCall: z.boolean(),
  /** 支持图像输入。 */
  imageInput: z.boolean(),
  /** 支持音频输入。 */
  audioInput: z.boolean(),
  /** 支持结构化输出（JSON schema）。 */
  structuredOutput: z.boolean(),
  /** 支持推理（思维链）。 */
  reasoning: z.boolean(),
  /** 嵌入模型。 */
  embedding: z.boolean().default(false),
  /** 支持流式输出。 */
  streaming: z.boolean().default(true),
});

export type ModelCapabilities = z.infer<typeof modelCapabilitiesSchema>;

/** 调用默认参数：调用方未显式传参时网关注入；均为可选。 */
export const defaultModelParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export type DefaultModelParams = z.infer<typeof defaultModelParamsSchema>;
