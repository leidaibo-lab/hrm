#!/usr/bin/env tsx
/**
 * agentic 保留归档演练：预检 → 显式 apply → 对账。
 * 环境：AGENTIC_BASE_URL（默认 http://localhost:3012）、INTERNAL_API_TOKEN；
 * 服务端必须 AGENTIC_RETENTION_APPLY=true 才能 apply。
 * 用法：pnpm exec tsx scripts/ops/retention-drill.ts [preflight|apply|full] [DELETE_EXPIRED]
 */

const baseUrl = (
  process.env.AGENTIC_BASE_URL ?? 'http://localhost:3012'
).replace(/\/$/, '');
const token = process.env.INTERNAL_API_TOKEN ?? '';
const command = process.argv[2] ?? 'preflight';
const confirm = process.argv[3] ?? '';

interface RetentionPreview {
  cutoffs: Record<string, string>;
  counts: { triggers: number; outbound: number; reports: number };
  applyEnabled: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-internal-token': token,
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json()) as T & {
    detail?: string;
    code?: string;
  };
  if (!response.ok)
    throw new Error(
      `${init.method ?? 'GET'} ${path} 失败：${response.status} ${
        body.code ?? ''
      } ${body.detail ?? ''}`.trim(),
    );
  return body;
}

function preview(): Promise<RetentionPreview> {
  return request<RetentionPreview>('/api/v1/internal/retention');
}

function apply(): Promise<{
  deleted: { triggers: number; outbound: number; reports: number };
}> {
  return request('/api/v1/internal/retention/apply', {
    method: 'POST',
    body: JSON.stringify({ confirm }),
  });
}

function print(label: string, value: unknown): void {
  console.log(`${label}: ${JSON.stringify(value)}`);
}

async function main(): Promise<void> {
  if (!token) throw new Error('缺少 INTERNAL_API_TOKEN');
  if (!['preflight', 'apply', 'full', 'reconcile'].includes(command))
    throw new Error(`未知命令：${command}`);
  if (
    (command === 'apply' || command === 'full') &&
    confirm !== 'DELETE_EXPIRED'
  )
    throw new Error('apply 需要显式确认串 DELETE_EXPIRED');

  const before = await preview();
  print('preflight', before);
  if (command === 'preflight' || command === 'reconcile') return;

  if (!before.applyEnabled)
    throw new Error(
      '服务端 AGENTIC_RETENTION_APPLY 不是 true，拒绝 apply；先完成审批并开启开关',
    );
  const applied = await apply();
  print('apply', applied);

  const after = await preview();
  print('reconcile', after);
  const remaining =
    after.counts.triggers + after.counts.outbound + after.counts.reports;
  const deleted =
    applied.deleted.triggers +
    applied.deleted.outbound +
    applied.deleted.reports;
  console.log(
    `对账：删除 ${deleted} 条，剩余过期 ${remaining} 条（演练环境应接近 0）`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
