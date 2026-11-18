import { ModelProvider } from '../domain/model-provider.entity';

/** Prisma 行 → 领域聚合；domain ← 持久化形态的唯一翻译点。 */
export function toProviderDomain(row: {
  id: string;
  slug: string;
  name: string;
  baseUrl: string;
  apiKeyCipher: string;
  timeoutMs: number | null;
  rateLimitPerMinute: number | null;
  maxConcurrent: number | null;
  enabled: boolean;
}): ModelProvider {
  return ModelProvider.reconstitute({
    id: row.id,
    slug: row.slug,
    name: row.name,
    baseUrl: row.baseUrl,
    apiKeyCipher: row.apiKeyCipher,
    timeoutMs: row.timeoutMs,
    rateLimitPerMinute: row.rateLimitPerMinute,
    maxConcurrent: row.maxConcurrent,
    enabled: row.enabled,
  });
}
