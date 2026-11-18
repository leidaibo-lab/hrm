// 登录/注册请求 schema 是跨端契约，唯一来源在 @cip/shared（契约管线规则 3）；此处只保留域内再导出。
export {
  type LoginInput,
  loginSchema,
  passwordSchema,
  type RegisterInput,
  registerSchema,
} from '@cip/shared';
