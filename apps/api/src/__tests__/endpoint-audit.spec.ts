import {
  NAVIGATION_CATALOG,
  PERMISSION,
  PERMISSION_CATALOG,
} from '@cip/shared';
import { RequestMethod, type Type } from '@nestjs/common';
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { IS_PUBLIC_KEY, REQUIRE_PERMISSION_KEY } from '../pipeline/guards';

/**
 * 端点权限审计：
 * 扫描 AppModule 全部 controller 路由，强制 deny by default——
 * 每条业务路由必须 @RequirePermission(...) 或 @Public()，或在「仅登录」白名单中显式登记。
 * 新增 controller 经模块 imports 自动纳入扫描，无登记遗漏。
 */
const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

interface RouteAudit {
  method: string;
  path: string;
  isPublic: boolean;
  permissions: string[];
  controller: string;
}

/** 「仅登录」白名单：无权限点要求但需会话的业务端点，逐个显式登记（审计例外）。 */
const AUTH_ONLY_ROUTES = new Set(['GET /auth/me', 'POST /auth/logout']);

/** @Public 允许面：auth 端点与探针。 */
const PUBLIC_ROUTES = new Set([
  'POST /auth/login',
  'POST /auth/register',
  'POST /auth/logout',
  'POST /connector/lark/:instanceId/events',
  // 内部契约：共享令牌由 InternalTokenGuard 校验（ADR-0049）。
  'POST /internal/runs',
  'POST /internal/reports',
  'POST /internal/artifacts',
  'POST /internal/effects/reconcile',
  'GET /internal/metrics',
  'GET /internal/retention',
  'POST /internal/retention/apply',
  'GET /healthz',
  'GET /readyz',
]);

function collectControllers(
  moduleClass: Type,
  seen: Set<Type> = new Set(),
): Type[] {
  if (seen.has(moduleClass)) return [];
  seen.add(moduleClass);
  const controllers = (Reflect.getMetadata(
    MODULE_METADATA.CONTROLLERS,
    moduleClass,
  ) ?? []) as Type[];
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ??
    []) as Type[];
  return [
    ...controllers,
    ...imports.flatMap((item) => collectControllers(item, seen)),
  ];
}

function joinPath(base: string, path: string | undefined): string {
  const normalized = path && path !== '/' ? path : '';
  return (
    `/${base}/${normalized}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  );
}

function collectRoutes(controller: Type): RouteAudit[] {
  const basePath = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const prototype = controller.prototype as Record<string, unknown>;
  const routes: RouteAudit[] = [];
  for (const name of Object.getOwnPropertyNames(prototype)) {
    if (name === 'constructor') continue;
    const handler = prototype[name] as (() => unknown) | undefined;
    if (typeof handler !== 'function') continue;
    const methodNumber = Reflect.getMetadata(METHOD_METADATA, handler) as
      | number
      | undefined;
    if (methodNumber === undefined) continue;
    routes.push({
      method: METHOD_NAMES[methodNumber] ?? 'GET',
      path: joinPath(
        basePath,
        Reflect.getMetadata(PATH_METADATA, handler) as string | undefined,
      ),
      isPublic:
        Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
        Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true,
      permissions:
        (Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler) as
          | string[]
          | undefined) ?? [],
      controller: controller.name,
    });
  }
  return routes;
}

const ROUTES = collectControllers(AppModule).flatMap((controller) =>
  collectRoutes(controller),
);
const CATALOG_CODES = new Set(PERMISSION_CATALOG.map((def) => def.code));

describe('端点权限审计', () => {
  it('能从 AppModule 扫描到全部 controller（防扫描失效）', () => {
    const controllers = new Set(ROUTES.map((route) => route.controller));
    expect([...controllers].sort()).toEqual([
      'AgentRegressionController',
      'AttentionController',
      'AuditController',
      'AuthController',
      'CatalogController',
      'FxController',
      'HealthLivenessController',
      'HealthReadinessController',
      'InternalController',
      'InternalMetricsController',
      'InternalRetentionController',
      'LarkController',
      'ModelController',
      'NavigationController',
      'PermissionPointController',
      'PolicyController',
      'PriceController',
      'ProviderController',
      'RoleController',
      'ScopeController',
      'SourceAuthorizationController',
      'SourceController',
      'ThreadController',
      'TicketController',
      'UsageController',
      'UserController',
    ]);
    expect(ROUTES.length).toBeGreaterThan(10);
  });

  it('deny by default：每条路由必须 @Public、声明权限点、或在仅登录白名单', () => {
    const violations = ROUTES.filter((route) => {
      const key = `${route.method} ${route.path}`;
      return (
        !route.isPublic &&
        route.permissions.length === 0 &&
        !AUTH_ONLY_ROUTES.has(key)
      );
    });
    expect(
      violations.map(
        (route) => `${route.method} ${route.path} (${route.controller})`,
      ),
    ).toEqual([]);
  });

  it('声明的权限点必须全部在 shared 目录内', () => {
    const violations = ROUTES.flatMap((route) => route.permissions).filter(
      (code) => !CATALOG_CODES.has(code),
    );
    expect(violations).toEqual([]);
  });

  it('@Public 仅限 auth 端点与探针', () => {
    const violations = ROUTES.filter(
      (route) =>
        route.isPublic && !PUBLIC_ROUTES.has(`${route.method} ${route.path}`),
    );
    expect(violations.map((route) => `${route.method} ${route.path}`)).toEqual(
      [],
    );
  });

  it('权限矩阵快照：权限面变更在 PR diff 中可见', async () => {
    const lines: string[] = ['# 权限矩阵（自动生成，勿手改）', ''];
    const byPermission = new Map<string, string[]>();
    for (const route of ROUTES) {
      for (const code of route.permissions) {
        byPermission.set(code, [
          ...(byPermission.get(code) ?? []),
          `${route.method} ${route.path}`,
        ]);
      }
    }
    for (const code of PERMISSION_CATALOG.map((def) => def.code)) {
      lines.push(`${code}`);
      for (const endpoint of byPermission.get(code) ?? [])
        lines.push(`  ${endpoint}`);
      if (!byPermission.has(code))
        lines.push('  （无端点引用 — 僵尸权限点，评审质询）');
    }
    lines.push('', '## 导航引用');
    for (const def of NAVIGATION_CATALOG) {
      if (def.permissionCode)
        lines.push(`  ${def.permissionCode} ← ${def.code}`);
    }
    lines.push('', '## 仅登录端点');
    for (const route of ROUTES.filter(
      (item) => !item.isPublic && item.permissions.length === 0,
    )) {
      lines.push(`  ${route.method} ${route.path}`);
    }
    lines.push('', '## @Public 端点');
    for (const route of ROUTES.filter((item) => item.isPublic)) {
      lines.push(`  ${route.method} ${route.path}`);
    }
    await expect(lines.join('\n')).toMatchFileSnapshot(
      '__snapshots__/permission-matrix.snap',
    );
  });

  // 引用保全：PERMISSION 直接使用避免被 tree-shaking 误删（目录常量是契约本体）
  it(PERMISSION.user.manage.code, () => {
    expect(CATALOG_CODES.has('user:manage')).toBe(true);
  });
});
