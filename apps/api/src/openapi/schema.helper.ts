import { z } from 'zod';

/**
 * zod 4 JSON Schema → Swagger SchemaObject 桥接。
 * 结构兼容但两套类型系统不重叠，统一在此强转（参照 health 探针既有模式）。
 */
export function toOpenApiSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}
