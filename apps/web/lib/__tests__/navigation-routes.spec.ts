import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NAVIGATION_CATALOG } from '@cip/shared';
import { describe, expect, it } from 'vitest';

/** 递归收集 app/ 目录下 page.tsx 对应的路由；路由组段（(workspace) 等）不产生路径。 */
function collectRoutes(dir: string, prefix = ''): Set<string> {
  const routes = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
      for (const route of collectRoutes(full, `${prefix}${segment}`))
        routes.add(route);
      continue;
    }
    if (entry.name === 'page.tsx') routes.add(prefix === '' ? '/' : prefix);
  }
  return routes;
}

describe('导航目录与前端路由一致性', () => {
  const routes = collectRoutes(join(process.cwd(), 'app'));
  const catalogWithChildren = new Set(
    NAVIGATION_CATALOG.filter((def) =>
      NAVIGATION_CATALOG.some((item) => item.parentCode === def.code),
    ).map((def) => def.code),
  );

  it('目录内每个叶子节点的 path 都对应真实路由（父级域为折叠入口可豁免）', () => {
    const missing = NAVIGATION_CATALOG.filter(
      (def) =>
        def.path !== null &&
        !catalogWithChildren.has(def.code) &&
        !routes.has(def.path),
    ).map((def) => `${def.code} → ${def.path}`);
    expect(missing).toEqual([]);
  });
});
