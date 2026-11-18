import 'dotenv/config';
import { z } from 'zod';

/** 环境变量 schema：定义启动期校验与默认值，校验失败即退出。 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().default(3011),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  /** 凭据加密主密钥（ADR-0015）：AES-256-GCM 主密钥，32 字节的 base64；仅经部署注入，禁止默认值。 */
  CREDENTIAL_MASTER_KEY: z
    .string()
    .min(1)
    .refine(
      (value) => Buffer.from(value, 'base64').length === 32,
      '必须是 32 字节（256 位）密钥的 base64 编码',
    ),
  /** 日志级别：开发 debug，生产部署注入 info。 */
  LOG_LEVEL: z.enum(['debug', 'info']).default('debug'),
  /** 日志美化：默认 JSON 结构化；开发 .env 注入 true 走 pino-pretty 单行彩色输出。 */
  LOG_PRETTY: z.stringbool().default(false),
  /** Cookie Secure 标记：生产（HTTPS）部署注入 true，cookie 仅随 HTTPS 发送。 */
  COOKIE_SECURE: z.stringbool().default(false),
  /** 会话有效期（秒），固定 TTL；默认 7 天。 */
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),
  /** 本地注册开关；关闭时注册页与注册端点同步不可用。 */
  AUTH_REGISTRATION_ENABLED: z.stringbool().default(true),
  /** 允许的浏览器来源：CORS 白名单与 CSRF Origin 校验共用。逗号分隔。 */
  AUTH_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3010')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  /** 注册邮箱域名白名单：空 = 不限制；非空时仅允许列表内域注册。逗号分隔。 */
  AUTH_ALLOWED_EMAIL_DOMAINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    ),
  /** 飞书事件订阅校验 token：空 = 不校验（仅开发）；生产部署必须注入。 */
  LARK_VERIFICATION_TOKEN: z.string().default(''),
  LARK_API_BASE: z.string().url().default('https://open.feishu.cn'),
  /** 出站发送限速：每来源实例每秒最多发送条数。 */
  OUTBOUND_RATE_PER_SECOND: z.coerce.number().int().positive().default(10),
  /** 入站事件限速：每来源实例每秒最多接收条数。 */
  INGRESS_RATE_PER_SECOND: z.coerce.number().int().positive().default(20),
  /** 内部契约共享令牌：空 = 内部接口未启用（仅开发）；生产必须注入。 */
  INTERNAL_API_TOKEN: z.string().default(''),
  /** 内部令牌可访问的项目范围；`*` 表示不限。 */
  INTERNAL_API_SCOPES: z.string().default('*'),
  /** 是否允许保留归档物理删除；默认关闭。 */
  AGENTIC_RETENTION_APPLY: z.enum(['true', 'false']).default('false'),
  /** 飞书应用 app_id：出站发送用；空 = 不发送。 */
  LARK_APP_ID: z.string().default(''),
  /** 飞书应用 app_secret：仅经部署注入，禁止默认值。 */
  LARK_APP_SECRET: z.string().default(''),
  LARK_ENCRYPT_KEY: z.string().default(''),
  /** 出站私网豁免主机（ADR-0038）：本地供应商联调显式注入，默认空 = 环回/私网全部阻断。逗号分隔精确主机名或 IP。 */
  OUTBOUND_ALLOW_PRIVATE_HOSTS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    ),
});

/** 生产环境安全断言：安全必需项缺失必须明确失败，禁止静默采用开发默认值。 */
function assertProductionSecurity(data: z.infer<typeof envSchema>): string[] {
  const violations: string[] = [];
  if (process.env.COOKIE_SECURE === undefined) {
    violations.push('COOKIE_SECURE 未注入');
  } else if (data.COOKIE_SECURE !== true) {
    violations.push('COOKIE_SECURE 必须为 true');
  }
  if (process.env.AUTH_ALLOWED_ORIGINS === undefined) {
    violations.push(
      'AUTH_ALLOWED_ORIGINS 未注入（生产必须显式提供来源白名单）',
    );
  }
  if (!data.LARK_ENCRYPT_KEY) {
    violations.push('LARK_ENCRYPT_KEY 未注入');
  }
  if (!data.LARK_VERIFICATION_TOKEN) {
    violations.push('LARK_VERIFICATION_TOKEN 未注入');
  }
  return violations;
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // fail-fast：环境变量缺失或不合法时直接退出，禁止带残缺配置启动
  console.error(
    '[env] 环境变量校验失败:',
    JSON.stringify(parsed.error.issues, null, 2),
  );
  process.exit(1);
}

// 生产环境安全断言（runtime：区分环境；生产必需项缺失必须明确失败），
// 漏注入 COOKIE_SECURE/AUTH_ALLOWED_ORIGINS 时 fail-fast 而非静默退化为开发默认值
if (process.env.NODE_ENV === 'production') {
  const violations = assertProductionSecurity(parsed.data);
  if (violations.length > 0) {
    console.error('[env] 生产环境安全断言失败:', violations);
    process.exit(1);
  }
}

/** 校验通过的环境变量；校验失败时进程已在此前退出。 */
export const env = parsed.data;
