import ts from 'typescript';
import type { Diagnostic } from './lib/diagnostics.js';

const FRAMEWORK = new Set([
  'dynamic',
  'revalidate',
  'metadata',
  'generateMetadata',
  'viewport',
  'runtime',
  'fetchCache',
  'preferredRegion',
  'maxDuration',
]);

/** 跳过精确 vendor、生成与测试路径；普通 ui 同名目录不获得豁免。 */
export function isBusinessSource(file: string): boolean {
  return (
    /^(apps\/(api\/src|web\/(app|components|features|hooks|lib))|packages\/[^/]+\/src)\//.test(
      file,
    ) &&
    /\.(ts|tsx)$/.test(file) &&
    !/(\/__tests__\/|\.(spec|test)\.tsx?$|\.d\.ts$)/.test(file) &&
    !/^(apps\/web\/(components\/(ui|ai-elements)|lib\/api-client)|apps\/api\/src\/platform\/prisma\/generated)\//.test(
      file,
    )
  );
}

function hasDoc(node: ts.Node): boolean {
  if (ts.getJSDocCommentsAndTags(node).some(ts.isJSDoc)) return true;
  const text = node.getSourceFile().text;
  const ranges = [
    ...(ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []),
    ...(ts.getTrailingCommentRanges(text, node.getFullStart()) ?? []),
  ];
  return ranges.some(
    (r) =>
      r.end <= node.getStart() && text.slice(r.pos, r.end).startsWith('/**'),
  );
}

function unparen(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) ? unparen(node.expression) : node;
}

function isNull(node: ts.Expression): boolean {
  return unparen(node).kind === ts.SyntaxKind.NullKeyword;
}

function jsxValue(node: ts.ConditionalExpression): boolean {
  let parent: ts.Node = node.parent;
  while (ts.isParenthesizedExpression(parent)) parent = parent.parent;
  return ts.isJsxExpression(parent) && !ts.isJsxAttribute(parent.parent);
}

/** AST 检查完整修改文件；返回语法问题，绝不把解析失败当无违规。 */
export function checkCode(file: string, text: string): Diagnostic[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const result: Diagnostic[] = [];
  const report = (
    node: ts.Node | number,
    rule: string,
    message: string,
    kind: Diagnostic['kind'] = 'violation',
  ) => {
    const pos = typeof node === 'number' ? node : node.getStart(source);
    result.push({
      rule,
      file,
      line: source.getLineAndCharacterOfPosition(pos).line + 1,
      message,
      kind,
    });
  };
  const parsed = source as ts.SourceFile & {
    parseDiagnostics: readonly ts.DiagnosticWithLocation[];
  };
  for (const item of parsed.parseDiagnostics)
    report(
      item.start ?? 0,
      'CHECK-PARSE',
      ts.flattenDiagnosticMessageText(item.messageText, '\n'),
      'error',
    );
  if (parsed.parseDiagnostics.length) return result;

  // Inspect parser-owned trivia gaps; never scan strings, regex or template text as comments.
  const comments = new Map<number, ts.CommentRange>();
  const trivia = (node: ts.Node): void => {
    for (const pos of [node.getFullStart(), node.end]) {
      for (const range of [
        ...(ts.getLeadingCommentRanges(text, pos) ?? []),
        ...(ts.getTrailingCommentRanges(text, pos) ?? []),
      ])
        comments.set(range.pos, range);
    }
    ts.forEachChild(node, trivia);
  };
  trivia(source);
  // CMT-4.4：引用（docs 路径、规范文档名、ADR/规则编号）不得成为注释主体；
  // 「契约说明 + 括注编号」并列合规——判定为移除全部引用后正文 CJK 不足 4 字。
  const REFERENCE_PATTERN =
    /(?:\bdocs\/(?:conventions|process|reference|decisions|prd)|\b(?:architecture|contracts|persistence|authorization|database|naming|documentation|frontend|web-ui-components|web-ui|forms|testing|code-comments|code-quality|security|runtime|boundaries|workflow|verification|governance)\.md\b|\b(?:ADR-\d{4}|PRD(?:-[A-Z]+|\s+(?:\d|F\d)))|\b[A-Z]{2,4}-\d+\.\d+\b|见\s*\S+\.md)/g;
  for (const range of comments.values()) {
    const comment = text.slice(range.pos, range.end);
    REFERENCE_PATTERN.lastIndex = 0;
    if (!REFERENCE_PATTERN.test(comment)) continue;
    const remainder = comment.replaceAll(REFERENCE_PATTERN, '');
    const cjkCount = remainder.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    if (cjkCount < 4)
      report(
        range.pos,
        'CMT-4.4',
        '注释必须自包含，移除文档路径或溯源编号并写清契约',
      );
  }

  const members = (node: ts.TypeNode | ts.InterfaceDeclaration): void => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        if (
          (ts.isPropertySignature(member) || ts.isMethodSignature(member)) &&
          !hasDoc(member)
        )
          report(
            member,
            'CMT-4.5',
            '公开对象类型的自行声明字段/方法必须有 JSDoc',
          );
        if (ts.isPropertySignature(member) && member.type) members(member.type);
      }
    } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const type of node.types) members(type);
    } else if (ts.isParenthesizedTypeNode(node)) members(node.type);
    else if (ts.isArrayTypeNode(node)) members(node.elementType);
    else if (ts.isTypeReferenceNode(node)) {
      for (const type of node.typeArguments ?? []) members(type);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isNonNullExpression(node))
      report(node, 'QLT-4.1', '禁止非空断言，使用校验或控制流收窄');
    if (ts.isCatchClause(node) && node.block.statements.length === 0)
      report(node, 'QLT-6.1', '禁止空 catch，必须显式处理失败或回退');
    if (ts.isConditionalExpression(node)) {
      if (
        [node.condition, node.whenTrue, node.whenFalse].some((part) =>
          ts.isConditionalExpression(unparen(part)),
        )
      )
        report(node, 'QLT-5.1', '禁止嵌套三元，使用命名条件与明确分支');
      if (jsxValue(node) && isNull(node.whenFalse))
        report(node, 'WEB-7.1', 'JSX 单分支显示使用布尔条件与 &&');
    }
    const exported =
      ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) {
      if (ts.isInterfaceDeclaration(node)) members(node);
      if (ts.isTypeAliasDeclaration(node)) members(node.type);
      let exempt = false;
      const name =
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node)
          ? node.name?.text
          : undefined;
      if (name && FRAMEWORK.has(name)) exempt = true;
      if (
        /^apps\/web\/app\//.test(file) &&
        /\/(page|layout|error|global-error|not-found|loading|template|default)\.tsx$/.test(
          file,
        )
      )
        exempt = true;
      if (
        ts.isClassDeclaration(node) &&
        ts
          .getDecorators(node)
          ?.some(
            (d) =>
              ts.isCallExpression(d.expression) &&
              /^(Controller|Module)$/.test(
                d.expression.expression.getText(source),
              ),
          )
      )
        exempt = true;
      if (
        ts.isTypeAliasDeclaration(node) &&
        !ts.isTypeLiteralNode(node.type) &&
        /^(?:z\.infer|typeof\s|(?:Pick|Omit|Partial|Readonly|Record|ReturnType|Parameters)<)/.test(
          node.type.getText(source),
        )
      )
        exempt = true;
      if (ts.isVariableStatement(node)) {
        exempt = node.declarationList.declarations.every((d) => {
          const init = d.initializer?.getText(source) ?? '';
          return (
            FRAMEWORK.has(d.name.getText(source)) ||
            /^(z|zod)\./.test(init) ||
            (/^[A-Z][A-Z0-9_]*$/.test(d.name.getText(source)) &&
              /^(?:['"\d]|true\b|false\b)/.test(init))
          );
        });
      }
      if (
        !exempt &&
        !hasDoc(node) &&
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isVariableStatement(node))
      )
        report(
          node,
          'CMT-4.1',
          '公开声明必须有关联的 JSDoc，普通块注释不能替代',
        );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}
