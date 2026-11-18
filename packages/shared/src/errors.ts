import { z } from 'zod';

/**
 * 平台业务错误码全集，字符串、域前缀分节。
 * 新增错误码必须先在此登记；前端依赖该 union 做窄化判断。
 */
export const ERROR_CODES = [
  // auth 域
  'auth.invalid_credentials',
  'auth.unauthorized',
  'auth.forbidden',
  'auth.origin_not_allowed',
  'auth.register_disabled',
  'auth.too_many_attempts',
  // user 域
  'user.not_found',
  'user.username_taken',
  // role 域
  'role.not_found',
  'role.unknown_permission',
  'role.builtin_protected',
  // navigation 域
  'navigation.node_not_found',
  // model 域：网关、供应商、模型、计价与目录接入的错误码（ADR-0015）
  'model.provider_not_found',
  'model.model_not_found',
  'model.provider_model_disabled',
  'model.rate_limited',
  'model.capability_unsupported',
  'model.slug_conflict',
  'model.logical_key_conflict',
  'model.model_conflict',
  'model.catalog_unavailable',
  'model.catalog_provider_not_found',
  'model.in_use',
  'model.logical_model_not_found',
  'model.no_candidate',
  'model.timeout',
  'model.provider_unavailable',
  'model.request_invalid',
  'model.credential_invalid',
  'model.request_cancelled',
  'model.candidate_not_found',
  'model.candidate_conflict',
  'model.price_not_found',
  'model.price_conflict',
  'model.fx_conflict',
  // request / health / server 域
  'request.invalid',
  'request.not_found',
  'health.db_unavailable',
  'health.redis_unavailable',
  'server.error',
] as const;

/** 平台业务错误码联合类型：problem details 的 code 成员取值域（zod enum 单源）。 */
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * 错误码命名映射：业务代码引用错误码的唯一入口（禁止散落字面量，契约管线规则 9）。
 * 与 ERROR_CODES 的一致性由 __tests__ 单测双向保证。
 */
export const ERROR_CODE = {
  auth: {
    invalidCredentials: 'auth.invalid_credentials',
    unauthorized: 'auth.unauthorized',
    forbidden: 'auth.forbidden',
    originNotAllowed: 'auth.origin_not_allowed',
    registerDisabled: 'auth.register_disabled',
    tooManyAttempts: 'auth.too_many_attempts',
  },
  user: {
    notFound: 'user.not_found',
    usernameTaken: 'user.username_taken',
  },
  role: {
    notFound: 'role.not_found',
    unknownPermission: 'role.unknown_permission',
    builtinProtected: 'role.builtin_protected',
  },
  navigation: {
    nodeNotFound: 'navigation.node_not_found',
  },
  model: {
    providerNotFound: 'model.provider_not_found',
    modelNotFound: 'model.model_not_found',
    providerModelDisabled: 'model.provider_model_disabled',
    rateLimited: 'model.rate_limited',
    capabilityUnsupported: 'model.capability_unsupported',
    slugConflict: 'model.slug_conflict',
    logicalKeyConflict: 'model.logical_key_conflict',
    modelConflict: 'model.model_conflict',
    catalogUnavailable: 'model.catalog_unavailable',
    catalogProviderNotFound: 'model.catalog_provider_not_found',
    inUse: 'model.in_use',
    logicalModelNotFound: 'model.logical_model_not_found',
    noCandidate: 'model.no_candidate',
    timeout: 'model.timeout',
    providerUnavailable: 'model.provider_unavailable',
    requestInvalid: 'model.request_invalid',
    credentialInvalid: 'model.credential_invalid',
    requestCancelled: 'model.request_cancelled',
    candidateNotFound: 'model.candidate_not_found',
    candidateConflict: 'model.candidate_conflict',
    priceNotFound: 'model.price_not_found',
    priceConflict: 'model.price_conflict',
    fxConflict: 'model.fx_conflict',
  },
  request: {
    invalid: 'request.invalid',
    notFound: 'request.not_found',
  },
  health: {
    dbUnavailable: 'health.db_unavailable',
    redisUnavailable: 'health.redis_unavailable',
  },
  server: {
    error: 'server.error',
  },
} as const satisfies Record<string, Record<string, ErrorCode>>;

export const errorCodeSchema = z.enum(ERROR_CODES);

/** RFC 9457 Problem Details（含平台扩展成员 code / traceId / errors）。 */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: errorCodeSchema,
  traceId: z.string(),
  errors: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
