#!/usr/bin/env tsx
/**
 * agentic 轻量压测：固定并发下打指定端点，输出吞吐、p50/p95/p99 与错误率。
 * 用法：
 *   AGENTIC_LOAD_URL=http://localhost:3012/api/v1/healthz \
 *   AGENTIC_LOAD_REQUESTS=200 AGENTIC_LOAD_CONCURRENCY=20 \
 *   pnpm exec tsx scripts/ops/load-test.ts
 * 认证：AGENTIC_LOAD_COOKIE、AGENTIC_LOAD_TOKEN（Bearer）或 AGENTIC_LOAD_INTERNAL_TOKEN（x-internal-token）。
 * 通过条件：错误率 ≤ AGENTIC_LOAD_MAX_ERROR_RATE（默认 0.01）且 p95 ≤ AGENTIC_LOAD_P95_MS（默认不限制）。
 */

const url =
  process.env.AGENTIC_LOAD_URL ?? 'http://localhost:3012/api/v1/healthz';
const requests = positiveInt('AGENTIC_LOAD_REQUESTS', 200);
const concurrency = positiveInt(
  'AGENTIC_LOAD_CONCURRENCY',
  Math.min(20, requests),
);
const timeoutMs = positiveInt('AGENTIC_LOAD_TIMEOUT_MS', 10_000);
const maxErrorRate = Number(process.env.AGENTIC_LOAD_MAX_ERROR_RATE ?? 0.01);
const p95Limit = Number(process.env.AGENTIC_LOAD_P95_MS ?? 0);
const cookie = process.env.AGENTIC_LOAD_COOKIE;
const token = process.env.AGENTIC_LOAD_TOKEN;
const internalToken = process.env.AGENTIC_LOAD_INTERNAL_TOKEN;

function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 1)
    throw new Error(`${name} 必须为正整数`);
  return Math.floor(value);
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
}

async function main(): Promise<void> {
  const latencies: number[] = [];
  const statuses = new Map<number, number>();
  let issued = 0;
  const startedAt = Date.now();

  const worker = async (): Promise<void> => {
    for (;;) {
      if (issued >= requests) return;
      issued += 1;
      const begin = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            ...(cookie ? { cookie } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(internalToken ? { 'x-internal-token': internalToken } : {}),
          },
        });
        await response.arrayBuffer();
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      } catch {
        statuses.set(0, (statuses.get(0) ?? 0) + 1);
      } finally {
        clearTimeout(timer);
        latencies.push(performance.now() - begin);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, requests) }, () => worker()),
  );
  const durationMs = Date.now() - startedAt;
  const failed = statuses.get(0) ?? 0;
  const non2xx = [...statuses.entries()]
    .filter(([status]) => status !== 0 && (status < 200 || status >= 300))
    .reduce((sum, [, count]) => sum + count, 0);
  const errors = failed + non2xx;
  const errorRate = errors / requests;
  const p95 = percentile(latencies, 0.95);
  const report = {
    url,
    requests,
    concurrency,
    durationMs,
    throughputPerSecond: Number(((requests / durationMs) * 1000).toFixed(2)),
    p50Ms: Number(percentile(latencies, 0.5).toFixed(1)),
    p95Ms: Number(p95.toFixed(1)),
    p99Ms: Number(percentile(latencies, 0.99).toFixed(1)),
    statuses: Object.fromEntries([...statuses.entries()].sort()),
    errors,
    errorRate: Number(errorRate.toFixed(4)),
  };
  console.log(JSON.stringify(report, null, 2));

  const tooManyErrors = errorRate > maxErrorRate;
  const tooSlow = p95Limit > 0 && p95 > p95Limit;
  if (tooManyErrors || tooSlow)
    throw new Error(
      `压测未达标：errorRate=${report.errorRate} (>${maxErrorRate}) p95=${report.p95Ms}ms (>${p95Limit || '不限'})`,
    );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
