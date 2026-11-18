import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ attempts: 0 }));

vi.mock('@mastra/pg', () => ({
  PostgresStore: class {
    async init(): Promise<void> {
      state.attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  },
}));

import { getAgentStorage } from '../storage.helper';

describe('getAgentStorage 并发初始化', () => {
  it('并发调用只初始化一次', async () => {
    const results = await Promise.all([
      getAgentStorage(),
      getAgentStorage(),
      getAgentStorage(),
    ]);
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
    expect(state.attempts).toBe(1);
  });
});
