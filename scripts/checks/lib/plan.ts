/** 验证命令使用参数数组，禁止将路径拼接为 shell 命令。 */
export interface CheckCommand {
  label: string;
  args: string[];
}

/** 验证计划覆盖包级依赖；未知源码或工程设施触发全仓验证。 */
export interface CheckPlan {
  packages: string[];
  database: boolean;
  contracts: boolean;
  governance: boolean;
  commands: CheckCommand[];
  manual: string[];
}

/** shared 变更传播到所有应用；删除/重命名保留在输入中，不按存在性过滤。 */
export function createPlan(files: string[], quick: boolean): CheckPlan {
  const packages = new Set<string>();
  const governance = files.some((p) =>
    /^(?:scripts\/|\.husky\/|docs\/|AGENTS\.md$|\.gitlab-ci\.yml$|.*(?:package\.json|lock\.yaml|tsconfig.*\.json|vitest\.config\.mts|biome\.json|turbo\.json)$)/.test(
      p,
    ),
  );
  const unknown = files.some(
    (p) =>
      /\.(?:ts|tsx|json|yaml|yml)$/.test(p) &&
      !/^(apps\/|packages\/|docs\/|scripts\/)/.test(p),
  );
  for (const file of files) {
    if (file.startsWith('apps/api/')) packages.add('api');
    if (file.startsWith('apps/web/')) packages.add('web');
    if (file.startsWith('packages/shared/') || governance || unknown)
      for (const pkg of ['shared', 'api', 'web']) packages.add(pkg);
    if (file.startsWith('packages/') && !file.startsWith('packages/shared/'))
      for (const pkg of ['shared', 'api', 'web']) packages.add(pkg);
  }
  const database = files.some((p) => p.startsWith('apps/api/prisma/'));
  const contracts =
    files.some(
      (p) =>
        /^apps\/api\//.test(p) &&
        /(?:dto\/|\.controller\.ts$|openapi\/|schema|app\.module)/.test(p),
    ) || files.some((p) => /^packages\/shared\//.test(p));
  const commands: CheckCommand[] = [];
  const add = (label: string, args: string[]) => commands.push({ label, args });
  const formatted = files.filter((p) =>
    /\.(?:[cm]?tsx?|json|jsonc|css|md|yml|yaml)$/.test(p),
  );
  // Per-file quick checks are performed by the runner to exclude deleted files.
  if (formatted.length)
    add('变更文件 Biome', [
      'exec',
      'biome',
      'check',
      '--no-errors-on-unmatched',
      '--',
      ...formatted,
    ]);
  if (governance) {
    add('文档', ['check:docs']);
    add('规则与全仓结构', ['check:rules']);
    add('保护设施', ['check:protected']);
  }
  if (!quick && files.length) {
    add('工程脚本类型', ['exec', 'tsc', '-p', 'tsconfig.json']);
    if (packages.has('api'))
      add('Prisma 客户端生成', ['--filter', '@cip/api', 'generate']);
    if (contracts || packages.has('web')) {
      add('离线 OpenAPI 导出', ['--filter', '@cip/api', 'export:openapi']);
      add('生成 Web client', ['--filter', '@cip/web', 'codegen']);
    }
    for (const pkg of ['shared', 'api', 'web']) {
      if (!packages.has(pkg)) continue;
      add(`${pkg} 类型`, [
        '--filter',
        `@cip/${pkg}`,
        pkg === 'shared' ? 'typecheck' : 'typecheck:ci',
      ]);
      add(`${pkg} 无服务测试`, [
        '--filter',
        `@cip/${pkg}`,
        pkg === 'api' ? 'test:unit' : 'test',
      ]);
    }
  }
  const manual = files.length
    ? [
        '复核适用条款的空值/精度、副作用、异常与业务语义；自动检查不替代人工验收',
      ]
    : [];
  if (
    database ||
    files.some((p) => /(?:\.prisma\.repository|\.mapper)\.ts$/.test(p))
  )
    manual.push(
      '核对隔离数据库的约束、删除、事务、并发与已有数据升级证据；缺少环境必须报告未验证',
    );
  if (files.some((p) => /(?:guard|permissions\/|authorization)/.test(p)))
    manual.push('验收权限撤销、资源范围隔离和 401/403 行为');
  if (
    files.some((p) =>
      /(?:lock\.yaml|package\.json|\.gitlab-ci|tsconfig|turbo\.json)/.test(p),
    )
  )
    manual.push(
      '构建/依赖变更另需构建与干净安装证据；本入口的无服务测试不证明发布可用',
    );
  return {
    packages: [...packages].sort(),
    database,
    contracts,
    governance,
    commands,
    manual,
  };
}

/** 连续保存合并为一次检查；结果过期后相同摘要也必须重新验证。 */
export class SaveCheckQueue {
  private observed = '';
  private checked = '';
  private stableSince = 0;

  shouldRun(digest: string, now: number): boolean {
    if (digest !== this.observed) {
      this.observed = digest;
      this.stableSince = now;
    }
    return digest !== this.checked && now - this.stableSince >= 1000;
  }

  complete(digest: string, stale: boolean): void {
    this.checked = stale ? '' : digest;
  }
}
