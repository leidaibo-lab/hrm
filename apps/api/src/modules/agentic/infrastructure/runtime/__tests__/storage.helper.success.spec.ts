import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ attempts: 0 }));

vi.mock('@mastra/pg', () => ({
  PostgresStore: class {
    async init(): Promise<void> {
      state.attempts += 1;
    }
  },
}));

import { getAgentStorage } from '../storage.helper';

describe('getAgentStorage 成功路径', () => {
  it('初始化一次后复用同一实例', async () => {
    const first = await getAgentStorage();
    const second = await getAgentStorage();
    expect(first).toBe(second);
    expect(first).toBeDefined();
    expect(state.attempts).toBe(1);
  });
});
