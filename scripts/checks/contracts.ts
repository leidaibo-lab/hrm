import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attachDependencies } from './lib/changes.js';
import type { Diagnostic } from './lib/diagnostics.js';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type ObjectValue = { [key: string]: Json };
function object(value: Json | undefined): ObjectValue {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}
function strings(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}
function canonical(value: Json | undefined): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/** 保守比较旧客户端兼容性；无法确定的组合约束变化也会阻止自动通过。 */
export function compareContracts(
  before: ObjectValue,
  after: ObjectValue,
): Diagnostic[] {
  const result: Diagnostic[] = [];
  const add = (path: string, message: string) =>
    result.push({
      rule: 'CON-7.1',
      file: 'apps/api/node_modules/.tmp/openapi.json',
      line: 1,
      kind: 'violation' as const,
      message: `${path}: ${message}`,
    });
  if (!before.openapi || !after.openapi || !before.paths || !after.paths) {
    add('OpenAPI', '必须提供有效的变更前后文档，缺失路径不能视为兼容');
    return result;
  }
  function deref(doc: ObjectValue, value: Json | undefined): ObjectValue {
    let schema = object(value);
    const references = new Set<string>();
    while (typeof schema.$ref === 'string') {
      const ref = schema.$ref;
      if (!ref.startsWith('#/'))
        throw new Error('不支持远端 OpenAPI 引用，必须人工核验');
      if (references.has(ref)) throw new Error('OpenAPI 引用循环没有实体定义');
      references.add(ref);
      let target: Json | undefined = doc;
      for (const key of ref.slice(2).split('/'))
        target =
          object(target)[key.replaceAll('~1', '/').replaceAll('~0', '~')];
      if (!target) throw new Error('OpenAPI 引用无法解析');
      schema = {
        ...object(target),
        ...Object.fromEntries(
          Object.entries(schema).filter(([k]) => k !== '$ref'),
        ),
      };
    }
    return schema;
  }

  const seen = new Set<string>();
  function schema(
    oldValue: Json | undefined,
    nextValue: Json | undefined,
    direction: 'request' | 'response',
    path: string,
  ): void {
    const key = `${direction}:${canonical(oldValue)}:${canonical(nextValue)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const a = deref(before, oldValue);
    const b = deref(after, nextValue);
    if (a.type !== b.type || a.format !== b.format || a.nullable !== b.nullable)
      if (
        canonical(a.type) !== canonical(b.type) ||
        a.format !== b.format ||
        a.nullable !== b.nullable
      )
        add(path, '类型、格式或可空性变化需要显式兼容决策');
    const requiredA = strings(a.required);
    const requiredB = strings(b.required);
    if (
      direction === 'request' &&
      requiredB.some((k) => !requiredA.includes(k))
    )
      add(path, '请求新增必填字段');
    if (
      direction === 'response' &&
      requiredA.some((k) => !requiredB.includes(k))
    )
      add(path, '响应不再保证旧必填字段');
    if (a.enum || b.enum) {
      const aEnum = Array.isArray(a.enum) ? a.enum.map(canonical) : null;
      const bEnum = Array.isArray(b.enum) ? b.enum.map(canonical) : null;
      const incompatible =
        direction === 'request'
          ? bEnum && (!aEnum || aEnum.some((v) => !bEnum.includes(v)))
          : aEnum && (!bEnum || bEnum.some((v) => !aEnum.includes(v)));
      if (incompatible) add(path, '枚举取值方向不兼容');
    }
    for (const field of [
      'minimum',
      'exclusiveMinimum',
      'minLength',
      'minItems',
      'minProperties',
      'maximum',
      'exclusiveMaximum',
      'maxLength',
      'maxItems',
      'maxProperties',
      'pattern',
      'multipleOf',
      'additionalProperties',
      'uniqueItems',
      'oneOf',
      'anyOf',
      'allOf',
      'not',
      'const',
      'discriminator',
    ])
      if (canonical(a[field]) !== canonical(b[field]))
        add(`${path}.${field}`, '约束发生变化，需显式兼容审查');
    for (const field of ['oneOf', 'anyOf', 'allOf']) {
      const oldBranches = a[field];
      const newBranches = b[field];
      if (
        Array.isArray(oldBranches) &&
        Array.isArray(newBranches) &&
        oldBranches.length === newBranches.length
      )
        oldBranches.forEach((branch, index) => {
          schema(
            branch,
            newBranches[index],
            direction,
            `${path}.${field}[${index}]`,
          );
        });
    }
    const ap = object(a.properties);
    const bp = object(b.properties);
    for (const [name, value] of Object.entries(ap)) {
      if (!(name in bp)) add(`${path}.${name}`, '旧契约字段被移除');
      else schema(value, bp[name], direction, `${path}.${name}`);
    }
    if (a.items) schema(a.items, b.items, direction, `${path}[]`);
  }
  function content(
    a: Json | undefined,
    b: Json | undefined,
    direction: 'request' | 'response',
    path: string,
  ): void {
    for (const [media, value] of Object.entries(object(a))) {
      const next = object(b)[media];
      if (!next) add(path, `移除媒体类型 ${media}`);
      else
        schema(
          object(value).schema,
          object(next).schema,
          direction,
          `${path}:${media}`,
        );
    }
  }
  const methods = new Set([
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
    'trace',
  ]);
  const oldPaths = object(before.paths);
  const newPaths = object(after.paths);
  for (const [path, item] of Object.entries(oldPaths)) {
    const oldItem = deref(before, item);
    const newItem = deref(after, newPaths[path]);
    for (const [method, operation] of Object.entries(oldItem)) {
      if (!methods.has(method)) continue;
      const label = `${method.toUpperCase()} ${path}`;
      const next = newItem[method];
      if (!next) {
        add(label, '旧端点被移除');
        continue;
      }
      const a = object(operation);
      const b = object(next);
      if (
        canonical(a.security ?? before.security) !==
        canonical(b.security ?? after.security)
      )
        add(label, '认证/授权契约变化');
      const params = (
        doc: ObjectValue,
        pathParams: Json | undefined,
        opParams: Json | undefined,
      ) => {
        const list = [
          ...(Array.isArray(pathParams) ? pathParams : []),
          ...(Array.isArray(opParams) ? opParams : []),
        ];
        return new Map(
          list.map((p) => {
            const v = deref(doc, p);
            return [`${v.in}:${v.name}`, v];
          }),
        );
      };
      const pa = params(before, oldItem.parameters, a.parameters);
      const pb = params(after, newItem.parameters, b.parameters);
      for (const [key, value] of pb) {
        const previous = pa.get(key);
        if (value.required === true && previous?.required !== true)
          add(`${label} ${key}`, '新增必填参数');
        if (previous)
          schema(previous.schema, value.schema, 'request', `${label} ${key}`);
      }
      for (const key of pa.keys())
        if (!pb.has(key)) add(`${label} ${key}`, '旧参数被移除');
      const ra = deref(before, a.requestBody);
      const rb = deref(after, b.requestBody);
      if (rb.required === true && ra.required !== true)
        add(label, '请求体改为必填');
      content(ra.content, rb.content, 'request', `${label} body`);
      const responses = object(b.responses);
      for (const [status, response] of Object.entries(object(a.responses))) {
        const value = responses[status];
        if (!value) add(`${label} ${status}`, '旧响应状态被移除');
        else {
          const oldResponse = deref(before, response);
          const newResponse = deref(after, value);
          content(
            oldResponse.content,
            newResponse.content,
            'response',
            `${label} ${status}`,
          );
          if (canonical(oldResponse.headers) !== canonical(newResponse.headers))
            add(`${label} ${status}`, '响应头契约变化需要审查');
        }
      }
    }
  }
  return result;
}

/** 基准源码在临时 checkout 离线导出；禁止通过复制当前契约伪造旧版本。 */
export function compareBaseContract(
  root: string,
  base: string,
  currentPath: string,
): Diagnostic[] {
  const snapshot = mkdtempSync(join(tmpdir(), 'cip-contract-'));
  try {
    const archive = execFileSync('git', ['archive', '--format=tar', base], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    });
    execFileSync('tar', ['-xf', '-', '-C', snapshot], { input: archive });
    attachDependencies(root, snapshot);
    const output = join(snapshot, 'before-openapi.json');
    execFileSync('pnpm', ['--filter', '@cip/api', 'export:openapi'], {
      cwd: snapshot,
      env: { ...process.env, OPENAPI_OUTPUT: output },
      stdio: 'pipe',
      maxBuffer: 16 * 1024 * 1024,
    });
    return compareContracts(
      JSON.parse(readFileSync(output, 'utf8')),
      JSON.parse(readFileSync(currentPath, 'utf8')),
    );
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}
