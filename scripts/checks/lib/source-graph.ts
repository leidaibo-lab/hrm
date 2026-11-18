import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

export interface ImportEdge {
  specifier: string | null;
  names: string[];
  locals?: string[];
  target?: string | null;
  unresolved?: boolean | null;
}
export interface SourceNode {
  file: string;
  source: string;
  imports: ImportEdge[];
}

/** 提取静态/动态/类型导入与再导出；未知动态目标显式报告。 */
export function readImports(source: string, file = 'source.ts'): ImportEdge[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports: ImportEdge[] = [];
  const visit = (node: ts.Node): void => {
    let value: ts.Node | undefined;
    let names: string[] = [];
    let locals: string[] = [];
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      value = node.moduleSpecifier;
      if (ts.isImportDeclaration(node)) {
        const binding = node.importClause?.namedBindings;
        if (binding && ts.isNamedImports(binding))
          names = binding.elements.map((e) => (e.propertyName ?? e.name).text);
        if (binding && ts.isNamedImports(binding))
          locals = binding.elements.map((e) => e.name.text);
        if (binding && ts.isNamespaceImport(binding)) {
          names = ['*'];
          locals = [binding.name.text];
        }
        if (node.importClause?.name) names.push('default');
      } else
        names =
          node.exportClause && ts.isNamedExports(node.exportClause)
            ? node.exportClause.elements.map(
                (e) => (e.propertyName ?? e.name).text,
              )
            : ['*'];
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      value = node.argument.literal;
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    )
      value = node.arguments[0] ?? node;
    if (value)
      imports.push({
        specifier: ts.isStringLiteralLike(value) ? value.text : null,
        names,
        locals,
      });
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return imports;
}

/** 读取 Nest Module 的具名装配与公开列表。 */
export function moduleMetadata(source: string): {
  imports: string[];
  exports: string[];
} {
  const ast = ts.createSourceFile(
    'module.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const result: { imports: string[]; exports: string[] } = {
    imports: [],
    exports: [],
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isDecorator(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Module'
    ) {
      const config = node.expression.arguments[0];
      if (config && ts.isObjectLiteralExpression(config))
        for (const property of config.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const key = property.name.getText(ast);
          if (
            (key !== 'imports' && key !== 'exports') ||
            !ts.isArrayLiteralExpression(property.initializer)
          )
            continue;
          result[key] = property.initializer.elements
            .filter(ts.isIdentifier)
            .map((e) => e.text);
        }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return result;
}

/** 以 TypeScript 配置解析完整导入图，生成产物和测试不会作为业务节点。 */
export function sourceGraph(root: string, configPath: string): SourceNode[] {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
    );
  const options = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(configPath),
  ).options;
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        [
          'node_modules',
          '.next',
          '__tests__',
          'generated',
          'api-client',
          '.git',
        ].includes(entry.name)
      )
        continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(full) && !full.endsWith('.d.ts'))
        files.push(full);
    }
  };
  walk(root);
  return files.map((file) => ({
    file: relative(root, file).replaceAll('\\', '/'),
    source: readFileSync(file, 'utf8'),
    imports: readImports(readFileSync(file, 'utf8'), file).map((item) => {
      const resolved =
        item.specifier &&
        ts.resolveModuleName(item.specifier, file, options, ts.sys)
          .resolvedModule?.resolvedFileName;
      return {
        ...item,
        target:
          resolved && !resolved.includes('/node_modules/')
            ? relative(root, resolved).replaceAll('\\', '/')
            : null,
        unresolved:
          !!item.specifier &&
          (item.specifier.startsWith('.') || item.specifier.startsWith('@/')) &&
          !resolved &&
          !existsSync(resolve(dirname(file), item.specifier)),
      };
    }),
  }));
}

/** 返回业务图中的循环，每个环仅报告一次。 */
export function cyclesOf(nodes: SourceNode[]): string[] {
  const graph = new Map(
    nodes.map((n) => [
      n.file,
      n.imports
        .map((i) => i.target)
        .filter((value): value is string => typeof value === 'string'),
    ]),
  );
  const done = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const cycles: string[] = [];
  const visit = (file: string): void => {
    if (active.has(file)) {
      cycles.push([...stack.slice(stack.indexOf(file)), file].join(' → '));
      return;
    }
    if (done.has(file) || !graph.has(file)) return;
    active.add(file);
    stack.push(file);
    for (const target of graph.get(file) ?? []) visit(target);
    stack.pop();
    active.delete(file);
    done.add(file);
  };
  for (const file of graph.keys()) visit(file);
  return cycles;
}

/** 检查 Web 分层；只对已有源节点应用业务依赖约束。 */
export function webViolations(nodes: SourceNode[]): string[] {
  const errors: string[] = [];
  for (const node of nodes) {
    if (/^components\/(ui|ai-elements)\//.test(node.file)) continue;
    const feature = node.file.match(/^features\/([^/]+)\//)?.[1];
    for (const item of node.imports) {
      const target = item.target;
      const report = (rule: string) =>
        errors.push(`${rule}: ${node.file} → ${item.specifier}`);
      if (!item.specifier || item.unresolved) report('无法解析的依赖');
      if (!target) continue;
      if (
        (node.file.startsWith('components/') &&
          (target.startsWith('features/') ||
            target.startsWith('lib/api-client'))) ||
        (node.file.startsWith('lib/') && target.startsWith('features/'))
      )
        report('WEB-9.1');
      if (target.startsWith('features/')) {
        const other = target.split('/')[1];
        // 域根出口之外，允许一层切片出口（features/<域>/<切片>/index.ts，ADR-0048）。
        const sliceExit = new RegExp(`^features/${other}/[^/]+/index.ts$`).test(
          target,
        );
        if (
          other !== feature &&
          target !== `features/${other}/index.ts` &&
          !sliceExit
        )
          report('WEB-9.2');
        if (
          feature &&
          other !== feature &&
          (feature !== 'workspace' || other === 'workspace')
        )
          report('WEB-9.1');
      }
      if (
        target.startsWith('lib/api-client/') &&
        !node.file.includes('/api/') &&
        node.file !== 'lib/api-client.setup.ts'
      )
        report('WEB-8.1');
    }
    if (
      /\bfetch\s*\(/.test(node.source) &&
      !['lib/session.ts', 'lib/health.ts'].includes(node.file)
    )
      errors.push(`WEB-9.3: ${node.file}`);
  }
  return [...errors, ...cyclesOf(nodes)];
}

/** 验证 API 真实公开面、barrel 与额外依赖红线。 */
export function apiViolations(nodes: SourceNode[]): string[] {
  const errors: string[] = [];
  const modules = new Map<
    string,
    { imports: string[]; exports: string[]; node: SourceNode }
  >();
  for (const node of nodes)
    if (/^modules\/([^/]+)\/\1\.module\.ts$/.test(node.file))
      modules.set(node.file.split('/')[1], {
        ...moduleMetadata(node.source),
        node,
      });
  for (const node of nodes) {
    const domain = node.file.match(/^modules\/([^/]+)\//)?.[1];
    for (const item of node.imports) {
      const target = item.target;
      const report = (rule: string) =>
        errors.push(`${rule}: ${node.file} → ${item.specifier}`);
      if (!item.specifier || item.unresolved) report('无法解析的依赖');
      if (
        node.file.includes('/domain/') &&
        item.specifier &&
        !item.specifier.startsWith('.') &&
        item.specifier !== '@cip/shared' &&
        !target
      )
        report('ARC-5.3');
      if (!target) continue;
      if (
        node.file.startsWith('platform/') &&
        /^(modules|pipeline|openapi|testing)\//.test(target)
      )
        report('ARC-5.1');
      if (node.file.startsWith('pipeline/') && target.startsWith('modules/'))
        report('ARC-5.1');
      if (
        node.file.includes('/application/') &&
        (/\/(infrastructure|dto)\//.test(target) ||
          /\.(controller|module)\.ts$/.test(target) ||
          target.startsWith('pipeline/') ||
          target.startsWith('platform/prisma/'))
      )
        report('ARC-5.2');
      if (
        node.file.includes('/domain/') &&
        (/\/(application|infrastructure|dto)\//.test(target) ||
          /\.(controller|module)\.ts$/.test(target))
      )
        report('ARC-5.3');
      if (
        node.file.endsWith('.controller.ts') &&
        /\/(domain|infrastructure)\//.test(target)
      )
        report('ARC-5.5');
      if (
        node.file.includes('/dto/') &&
        /^(modules|platform|pipeline|config|openapi|testing)\//.test(target) &&
        !target.includes('/dto/')
      )
        report('ARC-5.5');
      if (
        node.file.includes('/infrastructure/') &&
        (target.includes('/dto/') ||
          target.endsWith('.controller.ts') ||
          (target.startsWith(`modules/${domain}/`) &&
            target.includes('/application/')))
      )
        report('ARC-5.6');
      if (
        node.file.includes('/domain/') &&
        /^(platform|config|pipeline)\//.test(target)
      )
        report('ARC-5.3');
      const other = target.match(/^modules\/([^/]+)\//)?.[1];
      if (domain && other && domain !== other) {
        const owner = modules.get(other);
        const consumer = modules.get(domain);
        const isModule = target === `modules/${other}/${other}.module.ts`;
        const exported = owner?.node.imports.find((i) => i.target === target);
        const visible =
          owner &&
          exported &&
          item.names.length &&
          item.names.every((n) => {
            const index = exported.names.indexOf(n);
            return (
              index >= 0 &&
              owner.exports.includes(exported.locals?.[index] ?? n)
            );
          });
        const moduleBinding = consumer?.node.imports.find(
          (i) => i.target === `modules/${other}/${other}.module.ts`,
        );
        const wired = (
          moduleBinding?.locals?.length
            ? moduleBinding.locals
            : moduleBinding?.names
        )?.some((n) => consumer?.imports.includes(n) ?? false);
        if (!isModule && (!visible || !wired)) report('ARC-5.4');
      }
      const cap = target.match(
        /^(platform\/[^/]+|pipeline\/[^/]+|openapi|testing)\//,
      )?.[1];
      if (
        cap &&
        !node.file.startsWith(`${cap}/`) &&
        !target.startsWith('platform/prisma/generated/') &&
        target !== `${cap}/index.ts`
      )
        report('ARC-4.2');
    }
    if (
      node.file.includes('/application/') &&
      /['"]P20\d\d['"]/.test(node.source)
    )
      errors.push(`ARC-5.2 Prisma 错误泄漏: ${node.file}`);
    if (/\/ports\//.test(node.file) || node.file.endsWith('/index.module.ts'))
      errors.push(`禁止额外端口或模块组织: ${node.file}`);
  }
  return [...errors, ...cyclesOf(nodes)];
}
