import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { mpKeys } from '../../features/model-providers/api/keys';
import { ApiError } from '../api-error';
import { clearSessionCache } from '../query-client';

describe('身份与资源缓存', () => {
  it('不同供应商详情不共用缓存；表格托管键前缀失效覆盖 query 缓存', async () => {
    const client = new QueryClient();
    client.setQueryData(mpKeys.provider('a'), { name: 'A' });
    client.setQueryData(mpKeys.provider('b'), { name: 'B' });
    client.setQueryData(['table-view', 'mp-providers', 'u1', '-', '[]'], {
      rows: [],
    });
    expect(client.getQueryData(mpKeys.provider('a'))).toEqual({ name: 'A' });
    expect(client.getQueryData(mpKeys.provider('b'))).toEqual({ name: 'B' });
    await client.invalidateQueries({
      queryKey: ['model-provider', 'providers'],
    });
    expect(client.getQueryState(mpKeys.provider('a'))?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(mpKeys.provider('b'))?.isInvalidated).toBe(
      true,
    );
    await client.invalidateQueries({
      queryKey: ['table-view', 'mp-providers'],
    });
    expect(
      client.getQueryState(['table-view', 'mp-providers', 'u1', '-', '[]'])
        ?.isInvalidated,
    ).toBe(true);
    client.clear();
  });
  it('退出取消未完成请求，迟到结果不污染下一身份', async () => {
    const client = new QueryClient();
    let finish: ((value: string) => void) | undefined;
    let signal: AbortSignal | undefined;
    const pending = client.fetchQuery({
      queryKey: ['private'],
      queryFn: (context) => {
        signal = context.signal;
        return new Promise<string>((resolve) => {
          finish = resolve;
        });
      },
    });
    const rejected = expect(pending).rejects.toBeDefined();
    await clearSessionCache(client);
    await rejected;
    finish?.('旧账号数据');
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(client.getQueryData(['private'])).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('错误保留 code、status、traceId 和字段错误', () => {
    const error = new ApiError(
      {
        code: 'role.builtin_protected',
        status: 409,
        traceId: 'trace',
        errors: [{ path: 'name', message: '无效' }],
      },
      '失败',
    );
    expect(error).toMatchObject({
      message: '失败',
      code: 'role.builtin_protected',
      status: 409,
      traceId: 'trace',
      errors: [{ path: 'name', message: '无效' }],
    });
  });
});
