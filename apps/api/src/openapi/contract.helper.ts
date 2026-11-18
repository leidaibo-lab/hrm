import { problemDetailsSchema } from '@cip/shared';
import type { OpenAPIObject } from '@nestjs/swagger';
import { z } from 'zod';

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
] as const;

/**
 * 把响应 schema 内联的 $defs 提升进 components.schemas 并改写引用。
 * 背景：z.toJSONSchema 对递归/复用 schema 生成局部 $defs + `#/$defs/x` 引用，
 * 而 ref-parser 从文档根解析，悬空引用会令 codegen 崩溃。
 * 不同端点各自的局部命名（__schema0…）可能撞名，提升时按需加后缀去重。
 * @param document - Swagger 生成的 OpenAPI 文档，原地修改。
 */
function promoteInlineDefs(document: OpenAPIObject): void {
  document.components ??= {};
  document.components.schemas ??= {};
  const components = document.components.schemas as Record<string, unknown>;

  const rewriteRefs = (
    node: unknown,
    mapping: Record<string, string>,
  ): void => {
    if (Array.isArray(node)) {
      node.forEach((item) => {
        rewriteRefs(item, mapping);
      });
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.$ref === 'string') {
      const match = /^#\/\$defs\/(.+)$/.exec(record.$ref);
      if (match && mapping[match[1]]) record.$ref = mapping[match[1]];
    }
    for (const value of Object.values(record)) rewriteRefs(value, mapping);
  };

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const defs = record.$defs;
    if (defs && typeof defs === 'object') {
      const mapping: Record<string, string> = {};
      for (const [key, value] of Object.entries(
        defs as Record<string, unknown>,
      )) {
        let target = key;
        while (components[target] !== undefined) target = `${target}_`;
        components[target] = value;
        mapping[key] = `#/components/schemas/${target}`;
      }
      rewriteRefs(record, mapping);
      delete record.$defs;
    }
    for (const value of Object.values(record)) visit(value);
  };

  visit(document.paths);
}

/**
 * 把 ProblemDetails 错误契约注册进 OpenAPI：schema 进 components，
 * 所有操作的 default 响应引用之，前端 codegen 由此获得统一错误类型。
 * @param document - Swagger 生成的 OpenAPI 文档，原地修改。
 * @returns 注册错误契约后的同一文档实例。
 */
export function applyProblemDetailsContract(
  document: OpenAPIObject,
): OpenAPIObject {
  const problemJson = z.toJSONSchema(problemDetailsSchema, { io: 'input' });

  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ProblemDetails = problemJson as Record<
    string,
    unknown
  >;
  promoteInlineDefs(document);

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | { responses?: Record<string, unknown> }
        | undefined;
      if (!operation) continue;
      operation.responses ??= {};
      operation.responses.default ??= {
        description: 'RFC 9457 Problem Details',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ProblemDetails' },
          },
        },
      };
    }
  }
  return document;
}
