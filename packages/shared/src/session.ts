import { z } from 'zod';

/**
 * 会话 cookie 名：api 写入、web 透传的唯一会话标识。
 * 常量单源，两端禁止散落字面量。
 */
export const SESSION_COOKIE_NAME = 'sid';

/** 会话用户信息：/me 响应与登录/注册响应共用。 */
export const sessionUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string().nullable(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

/**
 * /me 导航树节点：api 合并覆盖与权限过滤后的最终形态，web 直接渲染。
 * 细则「前端消费」。
 */
export interface NavigationNodeDto {
  /** 业务编码。 */
  code: string;
  /** 父级编码。 */
  parentCode: string | null;
  /** 路径。 */
  path: string | null;
  /** 标题。 */
  title: string;
  /** 图标。 */
  icon: string | null;
  /** 排序值。 */
  sort: number;
  /** 子项集合。 */
  children: NavigationNodeDto[];
}

// 递归 schema 需要显式类型注解，避免 TS7022 自引用推断失败
export const navigationNodeSchema: z.ZodType<NavigationNodeDto> = z.object({
  code: z.string(),
  parentCode: z.string().nullable(),
  path: z.string().nullable(),
  title: z.string(),
  icon: z.string().nullable(),
  sort: z.number().int(),
  children: z.array(z.lazy(() => navigationNodeSchema)),
});

/**
 * 会话唯一接缝：web 侧 getSession() 的返回契约（apps/web/lib/session.ts 按此 parse）。
 * 权限点集合含 "*" 表示全量（super-admin）。
 */
export const sessionSchema = z.object({
  user: sessionUserSchema,
  permissions: z.array(z.string()),
  navigation: z.array(navigationNodeSchema),
});

export type Session = z.infer<typeof sessionSchema>;
