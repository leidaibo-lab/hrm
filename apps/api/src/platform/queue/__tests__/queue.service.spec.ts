import { describe, expect, it } from 'vitest';
import { sanitizeJobId } from '../queue.service';

describe('sanitizeJobId', () => {
  it('把冒号替换为短横线并追加哈希', () => {
    expect(sanitizeJobId('route:trigger-1')).toMatch(
      /^route-trigger-1-[0-9a-f]{8}$/,
    );
    expect(sanitizeJobId('reply:ticket:1')).toMatch(
      /^reply-ticket-1-[0-9a-f]{8}$/,
    );
    expect(sanitizeJobId('a:b')).not.toBe(sanitizeJobId('a-b'));
  });

  it('无冒号与空值保持原样', () => {
    expect(sanitizeJobId('plain-id')).toBe('plain-id');
    expect(sanitizeJobId(undefined)).toBeUndefined();
  });
});
