/**
 * agentic 多副本租约演练：两个 Redis 客户端争抢同一 NX 锁，验证互斥与释放。
 * 用法：pnpm --filter @cip/api exec tsx scripts/ops/lease-check.ts
 */
import Redis from 'ioredis';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
const key = `agentic:lease-check:${Date.now()}`;
const owner = `${process.pid}-a`;
const contender = `${process.pid}-b`;
const ttlMs = 5_000;

async function main(): Promise<void> {
  const first = new Redis(url);
  const second = new Redis(url);
  try {
    const acquired = await first.set(key, owner, 'PX', ttlMs, 'NX');
    const blocked = await second.set(key, contender, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK' || blocked !== null)
      throw new Error(
        `租约互斥失败：first=${String(acquired)} second=${String(blocked)}`,
      );
    const release = await first.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      owner,
    );
    if (release !== 1) throw new Error('租约释放失败：owner 不匹配');
    const reacquired = await second.set(key, contender, 'PX', ttlMs, 'NX');
    if (reacquired !== 'OK') throw new Error('释放后未能重新获取租约');
    await second.del(key);
    console.log(`lease ok: ${key} 互斥、释放、再获取通过（ttl=${ttlMs}ms）`);
  } finally {
    await first.quit();
    await second.quit();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
