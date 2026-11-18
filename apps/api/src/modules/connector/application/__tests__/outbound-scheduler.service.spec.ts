import { describe, expect, it } from 'vitest';
import type { OutboundDispatcherService } from '../outbound-dispatcher.service';
import { OutboundSchedulerService } from '../outbound-scheduler.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeDispatcher {
  calls = 0;
  error: Error | null = null;
  gate: Promise<void> | null = null;

  async dispatchDue(): Promise<unknown> {
    this.calls += 1;
    if (this.gate) await this.gate;
    if (this.error) throw this.error;
    return { sent: 0, failed: 0, gone: 0 };
  }
}

function makeScheduler(): {
  scheduler: OutboundSchedulerService;
  dispatcher: FakeDispatcher;
} {
  const dispatcher = new FakeDispatcher();
  return {
    scheduler: new OutboundSchedulerService(
      dispatcher as unknown as OutboundDispatcherService,
    ),
    dispatcher,
  };
}

describe('OutboundSchedulerService.tick', () => {
  it('一轮内执行一次派发', async () => {
    const { scheduler, dispatcher } = makeScheduler();
    await scheduler.tick(AT);
    expect(dispatcher.calls).toBe(1);
  });

  it('上一轮未结束时跳过', async () => {
    const { scheduler, dispatcher } = makeScheduler();
    let release: () => void = () => {};
    dispatcher.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = scheduler.tick(AT);
    await scheduler.tick(AT);
    expect(dispatcher.calls).toBe(1);
    release();
    await first;
  });

  it('失败后记录并允许下一轮继续', async () => {
    const { scheduler, dispatcher } = makeScheduler();
    dispatcher.error = new Error('redis down');

    await expect(scheduler.tick(AT)).resolves.toBeUndefined();
    dispatcher.error = null;
    await scheduler.tick(AT);

    expect(dispatcher.calls).toBe(2);
  });
});
