import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  apiViolations,
  cyclesOf,
  readImports,
  sourceGraph,
  webViolations,
} from '../../../../scripts/checks/lib/source-graph.js';

describe('Web 架构', () => {
  it('真实源码符合 feature 与技术接缝边界', () => {
    expect(
      webViolations(sourceGraph(process.cwd(), resolve('tsconfig.json'))),
    ).toEqual([]);
  });
  it('导入分析覆盖再导出、类型、动态和副作用，忽略注释', () => {
    expect(
      readImports(
        `// import 'fake';\nimport './side'; export * from './barrel'; type T = import('./type').T; import('./dynamic'); import(path);`,
      ).map((i) => i.specifier),
    ).toEqual(['./side', './barrel', './type', './dynamic', null]);
  });
  it('alias、目录出口与间接再导出按 tsconfig 解析', () => {
    const root = mkdtempSync(join(tmpdir(), 'cip-graph-'));
    try {
      const files: Record<string, string> = {
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            moduleResolution: 'bundler',
            module: 'esnext',
            paths: { '@/*': ['./*'] },
          },
        }),
        'entry.ts': "import { x } from '@/feature';",
        'feature/index.ts': "export { x } from './internal';",
        'feature/internal.ts': 'export const x = 1;',
      };
      for (const [file, source] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), source);
      }
      const graph = sourceGraph(root, join(root, 'tsconfig.json'));
      expect(graph.find((n) => n.file === 'entry.ts')?.imports[0].target).toBe(
        'feature/index.ts',
      );
      expect(
        graph.find((n) => n.file === 'feature/index.ts')?.imports[0].target,
      ).toBe('feature/internal.ts');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('拒绝通用组件取数、跨 feature 深导入、反向依赖和循环', () => {
    const node = (file: string, target: string) => ({
      file,
      source: '',
      imports: [{ specifier: target, names: [], target }],
    });
    expect(
      webViolations([node('components/table.tsx', 'features/auth/index.ts')]),
    ).not.toEqual([]);
    expect(
      webViolations([
        node(
          'features/workspace/components/shell.tsx',
          'features/auth/index.ts',
        ),
      ]),
    ).toEqual([]);
    expect(
      webViolations([
        node(
          'features/workspace/components/shell.tsx',
          'features/auth/api/session.ts',
        ),
      ]),
    ).not.toEqual([]);
    expect(
      webViolations([
        node('features/auth/api/session.ts', 'features/workspace/index.ts'),
      ]),
    ).not.toEqual([]);
    expect(
      webViolations([node('lib/utils.ts', 'features/auth/index.ts')]),
    ).not.toEqual([]);
    expect(
      webViolations([
        node('lib/api-client.setup.ts', 'lib/api-client/client.gen.ts'),
      ]),
    ).toEqual([]);
    expect(cyclesOf([node('a.ts', 'b.ts'), node('b.ts', 'a.ts')])).toHaveLength(
      1,
    );
  });
  it('路径别名和再导出不能隐藏跨 feature 内部依赖，未知动态目标必须报告', () => {
    const root = mkdtempSync(join(tmpdir(), 'cip-boundary-'));
    try {
      const files: Record<string, string> = {
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            moduleResolution: 'bundler',
            module: 'esnext',
            paths: { '@/*': ['./*'] },
          },
        }),
        'features/workspace/components/shell.tsx':
          "import type { Secret } from '@/features/auth/api/internal'; import('@/features/auth/api/internal');",
        'features/workspace/index.ts':
          "export * from '@/features/auth/api/internal';",
        'features/auth/api/internal.ts': 'export type Secret = string;',
      };
      for (const [file, source] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), source);
      }
      const rejected = webViolations(
        sourceGraph(root, join(root, 'tsconfig.json')),
      );
      expect(
        rejected.filter((message) => message.startsWith('WEB-9.2')),
      ).toHaveLength(3);
      expect(
        webViolations([
          {
            file: 'features/workspace/api/query.ts',
            source: '',
            imports: [{ specifier: null, names: [] }],
          },
        ]).join(),
      ).toContain('无法解析的依赖');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('类与模块使用导入别名时，仍按真实 Nest exports 和 imports 校验', () => {
    const nodes = [
      {
        file: 'modules/a/a.module.ts',
        source: '@Module({ imports: [RenamedModule] }) class AModule {}',
        imports: [
          {
            specifier: '../b/b.module',
            target: 'modules/b/b.module.ts',
            names: ['BModule'],
            locals: ['RenamedModule'],
          },
        ],
      },
      {
        file: 'modules/b/b.module.ts',
        source: '@Module({ exports: [RenamedService] }) class BModule {}',
        imports: [
          {
            specifier: './application/public.service',
            target: 'modules/b/application/public.service.ts',
            names: ['PublicService'],
            locals: ['RenamedService'],
          },
        ],
      },
      {
        file: 'modules/a/application/a.service.ts',
        source: '',
        imports: [
          {
            specifier: '../../b/application/public.service',
            target: 'modules/b/application/public.service.ts',
            names: ['PublicService'],
            locals: ['Alias'],
          },
        ],
      },
    ];
    expect(apiViolations(nodes)).toEqual([]);
    nodes[1].source = '@Module({ exports: [] }) class BModule {}';
    expect(apiViolations(nodes).join()).toContain('ARC-5.4');
  });
  it('真实 exports 与模块装配都必须满足，拒绝仅文件导出的内部服务', () => {
    const edge = (target: string, name: string) => ({
      target,
      specifier: target,
      names: [name],
    });
    const nodes = [
      {
        file: 'modules/a/a.module.ts',
        source: '@Module({ imports: [BModule] }) class AModule {}',
        imports: [edge('modules/b/b.module.ts', 'BModule')],
      },
      {
        file: 'modules/b/b.module.ts',
        source: '@Module({ exports: [PublicService] }) class BModule {}',
        imports: [
          edge('modules/b/application/public.service.ts', 'PublicService'),
        ],
      },
      {
        file: 'modules/a/application/a.service.ts',
        source: '',
        imports: [
          edge('modules/b/application/public.service.ts', 'PublicService'),
        ],
      },
    ];
    expect(apiViolations(nodes)).toEqual([]);
    nodes[2].imports = [
      edge('modules/b/application/private.service.ts', 'PrivateService'),
    ];
    expect(apiViolations(nodes).join()).toContain('ARC-5.4');
    nodes[2].imports = [
      edge('modules/b/application/public.service.ts', 'PublicService'),
    ];
    nodes[0].source = '@Module({}) class AModule {}';
    expect(apiViolations(nodes).join()).toContain('ARC-5.4');
  });
});

describe('shared 纯依赖与框架入口', () => {
  it('shared 禁止依赖具体应用、框架和服务 I/O', () => {
    const nodes = sourceGraph(
      resolve('../../packages/shared/src'),
      resolve('../../packages/shared/tsconfig.json'),
    );
    const forbidden = nodes.flatMap((n) =>
      n.imports
        .filter(
          (i) =>
            /^(node:|@nestjs|react|@prisma|@cip\/(api|web))/.test(
              i.specifier ?? '',
            ) || i.target?.startsWith('../'),
        )
        .map((i) => `${n.file} → ${i.specifier}`),
    );
    expect(forbidden).toEqual([]);
  });
});
