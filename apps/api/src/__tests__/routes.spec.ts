import { RequestMethod, type Type } from '@nestjs/common';
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';

/**
 * 路由治理（ADR-0019）：命名、动作子路径、唯一性、OpenAPI 必填项。
 * 与 endpoint-audit.spec 互补：那边管权限，这边管路由形态与契约文档。
 */
const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

const ACTION_SEGMENTS = new Set([
  'test',
  'activate',
  'suspend',
  'enable',
  'disable',
  'archive',
]);

/** 协议端点：路径由探针/认证协议固定，不参与业务路由命名与层级约束。 */
const PROTOCOL_CONTROLLER_PATHS = new Set(['healthz', 'readyz', 'auth']);

/** 领域前缀段：仅做分组，不计入 controller 嵌套层数。 */
const DOMAIN_PREFIX_SEGMENTS = new Set(['ai']);

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** @nestjs/swagger 把 @ApiOperation 的入参写到该元数据键。 */
const API_OPERATION_METADATA = 'swagger/apiOperation';

interface RouteRow {
  method: string;
  path: string;
  controllerPath: string;
  controller: string;
  handlerName: string;
  operationSummary: string;
  hasTags: boolean;
}

function collectControllers(moduleClass: Type, seen = new Set<Type>()): Type[] {
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

function joinPath(base: string | undefined, path: string | undefined): string {
  const normalizedBase = base && base !== '/' ? base : '';
  const normalizedPath = path && path !== '/' ? path : '';
  return (
    `/${normalizedBase}/${normalizedPath}`
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/'
  );
}

/** 读取 handler 上的 @ApiOperation 摘要；未声明时返回空串。 */
function readOperationSummary(handler: () => unknown): string {
  const operation = Reflect.getMetadata(API_OPERATION_METADATA, handler) as
    | { summary?: unknown }
    | undefined;
  return typeof operation?.summary === 'string' ? operation.summary : '';
}

function collectRoutes(controller: Type): RouteRow[] {
  const basePath =
    (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ??
    '';
  const hasTags =
    Reflect.getMetadata('swagger/apiUseTags', controller) !== undefined;
  const prototype = controller.prototype as Record<string, unknown>;
  const routes: RouteRow[] = [];
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
      controllerPath: basePath,
      controller: controller.name,
      handlerName: name,
      operationSummary: readOperationSummary(handler),
      hasTags,
    });
  }
  return routes;
}

// controller 路径的业务段：剔除参数段与领域前缀段
function controllerSegments(route: RouteRow): string[] {
  const segments = route.controllerPath
    .split('/')
    .filter((segment) => segment.length > 0 && !segment.startsWith(':'));
  return segments.length > 0 && DOMAIN_PREFIX_SEGMENTS.has(segments[0])
    ? segments.slice(1)
    : segments;
}

const ROUTES = collectControllers(AppModule).flatMap(collectRoutes);

describe('路由治理', () => {
  it('扫描结果非空（防止 AppModule 变更导致全空过）', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it('路径段必须 kebab-case（空/参数段除外）', () => {
    const violations = ROUTES.filter((route) =>
      route.path
        .split('/')
        .filter((segment) => segment.length > 0 && !segment.startsWith(':'))
        .some((segment) => !KEBAB_CASE.test(segment)),
    ).map((route) => `${route.method} ${route.path}`);
    expect(violations).toEqual([]);
  });

  it('controller 路径段必须 kebab-case 且嵌套不超过 2 层', () => {
    const violations = ROUTES.filter((route) => {
      if (PROTOCOL_CONTROLLER_PATHS.has(route.controllerPath)) return false;
      const segments = controllerSegments(route);
      return (
        segments.length > 2 ||
        segments.some((segment) => !KEBAB_CASE.test(segment))
      );
    }).map((route) => `${route.controller}（${route.controllerPath || '/'}）`);
    expect(violations).toEqual([]);
  });

  it('动作子路径必须使用 POST', () => {
    const violations = ROUTES.filter((route) => {
      const action = route.path
        .split('/')
        .find((segment) => ACTION_SEGMENTS.has(segment));
      return action !== undefined && route.method !== 'POST';
    }).map((route) => `${route.method} ${route.path}`);
    expect(violations).toEqual([]);
  });

  it('路由不得重复', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const route of ROUTES) {
      const key = `${route.method} ${route.path}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('每个 controller 必须有 ApiTags', () => {
    const violations = ROUTES.filter((route) => !route.hasTags).map(
      (route) => `${route.method} ${route.path} (${route.controller})`,
    );
    expect(violations).toEqual([]);
  });

  it('每条路由必须有非空的 ApiOperation 摘要', () => {
    const violations = ROUTES.filter(
      (route) => route.operationSummary.trim().length === 0,
    ).map(
      (route) =>
        `${route.method} ${route.path} (${route.controller}.${route.handlerName})`,
    );
    expect(violations).toEqual([]);
  });
});
