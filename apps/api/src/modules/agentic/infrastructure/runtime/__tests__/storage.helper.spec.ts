import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ attempts: 0 }));

vi.mock('@mastra/pg', () => ({
  PostgresStore: class {
    async init(): Promise<void> {
      state.attempts += 1;
      throw new Error('db down');
    }
  },
}));

import { getAgentStorage } from '../storage.helper';

describe('getAgentStorage', () => {
  it('初始化失败时降级为 undefined 并允许重试', async () => {
    await expect(getAgentStorage()).resolves.toBeUndefined();
    await expect(getAgentStorage()).resolves.toBeUndefined();
    expect(state.attempts).toBe(2);
  });
});
