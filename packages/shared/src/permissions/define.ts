/**
 * 权限点目录条目：code 是三端（shared / api / web）共用的契约本体，禁止在业务代码手写字面量。
 * 细则「权限点目录」。
 */
export interface PermissionDef {
  /** 业务编码。 */
  readonly code: string;
  /** 资源名称。 */
  readonly resource: string;
  /** 操作名称。 */
  readonly action: string;
  /** 人类可读说明；后台配置面与审计展示用，禁止空泛表述。 */
  readonly summary: string;
}

/**
 * 构造目录条目；泛型保留字面量类型，供 PERMISSION 常量推导 PermissionCode 联合类型。
 * @param resource - 资源域，必须与 api 模块域名一致。
 * @param action - 受控动词（read/create/update/delete/manage）。
 * @param summary - 人类可读说明。
 */
export function perm<R extends string, A extends string>(
  resource: R,
  action: A,
  summary: string,
): {
  readonly code: `${R}:${A}`;
  readonly resource: R;
  readonly action: A;
  readonly summary: string;
} {
  return { code: `${resource}:${action}`, resource, action, summary };
}
