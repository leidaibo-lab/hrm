#!/usr/bin/env tsx
/**
 * 闸门锁并发压测：对同一 attention 并发回答，统计 200/409。
 * 用法：
 *   AGENTIC_BASE_URL=http://localhost:3012 AGENTIC_ATTENTION_ID=att-1 \
 *   AGENTIC_LOAD_COOKIE='cip_sid=...' AGENTIC_LOAD_REQUESTS=20 \
 *   pnpm exec tsx scripts/ops/gate-lock-load.ts
 * 预期：1×200 + (N-1)×409；若出现 5xx 说明锁/状态映射异常。
 */
const baseUrl = (
  process.env.AGENTIC_BASE_URL ?? 'http://localhost:3012'
).replace(/\/$/, '');
const attentionId = process.env.AGENTIC_ATTENTION_ID;
const cookie = process.env.AGENTIC_LOAD_COOKIE;
const requests = Number(process.env.AGENTIC_LOAD_REQUESTS ?? 20);
const decision = process.env.AGENTIC_LOAD_DECISION ?? 'reject';

async function main(): Promise<void> {
  if (!attentionId || !cookie)
    throw new Error('缺少 AGENTIC_ATTENTION_ID 或 AGENTIC_LOAD_COOKIE');
  if (!Number.isInteger(requests) || requests < 1)
    throw new Error('AGENTIC_LOAD_REQUESTS 必须为正整数');
  const url = `${baseUrl}/api/v1/agentic/attention/${encodeURIComponent(attentionId)}/answer`;
  const statuses: Record<number, number> = {};
  const started = Date.now();
  await Promise.all(
    Array.from({ length: requests }, async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ answer: 'load-test', decision }),
        });
        statuses[response.status] = (statuses[response.status] ?? 0) + 1;
        await response.arrayBuffer();
      } catch {
        statuses[0] = (statuses[0] ?? 0) + 1;
      }
    }),
  );
  const report = {
    url,
    requests,
    decision,
    durationMs: Date.now() - started,
    statuses,
  };
  console.log(JSON.stringify(report, null, 2));
  const unexpected = Object.entries(statuses).filter(
    ([status]) => status !== '200' && status !== '409',
  );
  if (unexpected.length > 0)
    throw new Error(`出现非 200/409 响应：${JSON.stringify(unexpected)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
