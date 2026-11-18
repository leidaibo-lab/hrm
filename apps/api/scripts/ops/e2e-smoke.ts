/**
 * agentic 联调冒烟：健康、内部端点与飞书回调验签/挑战应答。
 * 用法：
 *   AGENTIC_BASE_URL=http://localhost:3012 \
 *   INTERNAL_API_TOKEN=*** LARK_INSTANCE_ID=inst-1 \
 *   LARK_VERIFICATION_TOKEN=*** [LARK_ENCRYPT_KEY=***] \
 *   pnpm --filter @cip/api exec tsx scripts/ops/e2e-smoke.ts
 * 只做只读与 challenge 校验，不创建工单、不发送消息。
 */
import { createHash } from 'node:crypto';

const baseUrl = (
  process.env.AGENTIC_BASE_URL ?? 'http://localhost:3012'
).replace(/\/$/, '');
const internalToken = process.env.INTERNAL_API_TOKEN ?? '';
const instanceId = process.env.LARK_INSTANCE_ID ?? '';
const verificationToken = process.env.LARK_VERIFICATION_TOKEN ?? '';
const encryptKey = process.env.LARK_ENCRYPT_KEY ?? '';
const challenge = `smoke-${Date.now()}`;

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

async function http(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

async function main(): Promise<void> {
  const missing = [
    !internalToken && 'INTERNAL_API_TOKEN',
    !instanceId && 'LARK_INSTANCE_ID',
  ].filter(Boolean);
  if (missing.length > 0)
    throw new Error(`缺少环境变量：${missing.join(', ')}`);

  const checks: Check[] = [];

  const health = await http('/healthz');
  checks.push({
    name: 'healthz',
    ok: health.status === 200,
    detail: `HTTP ${health.status}`,
  });

  const metrics = await http('/api/v1/internal/metrics', {
    headers: { 'x-internal-token': internalToken },
  });
  checks.push({
    name: 'internal.metrics',
    ok: metrics.status === 200,
    detail: `HTTP ${metrics.status}`,
  });

  const raw = JSON.stringify({
    type: 'url_verification',
    token: verificationToken,
    challenge,
  });
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (encryptKey) {
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const nonce = `smoke-${timestamp}`;
    headers['x-lark-request-timestamp'] = timestamp;
    headers['x-lark-request-nonce'] = nonce;
    headers['x-lark-signature'] = createHash('sha256')
      .update(timestamp + nonce + encryptKey + raw)
      .digest('hex');
  }
  const callback = await http(
    `/api/v1/connector/lark/${encodeURIComponent(instanceId)}/events`,
    { method: 'POST', headers, body: raw },
  );
  const returned =
    callback.body && typeof callback.body === 'object'
      ? (callback.body as { challenge?: unknown }).challenge
      : undefined;
  checks.push({
    name: 'lark.url_verification',
    ok: callback.status === 200 && returned === challenge,
    detail: `HTTP ${callback.status} challenge=${String(returned)}`,
  });

  console.log(JSON.stringify({ baseUrl, checks }, null, 2));
  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0)
    throw new Error(
      `联调冒烟失败：${failed.map((item) => item.name).join(', ')}`,
    );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
