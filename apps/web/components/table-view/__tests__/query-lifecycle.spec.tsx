// @vitest-environment jsdom
import { SortDirection } from '@cip/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useSessionStorage } from '@/hooks/use-session-storage';
import { createTableQuery } from '@/lib/table-query';
import { createColumns, FilterOperator, TableView } from '../index';
import { tableScopeKey } from '../model/scope-key';
import type { TableQueryFn } from '../types';

type Row = { id: string; name: string; status: string };
const columns = createColumns<Row>(({ primary, text }) => [
  primary('name', '名称', { sortable: true }),
  text('status', '状态', {
    filter: { operators: [FilterOperator.Equal, FilterOperator.NotEqual] },
  }),
]);
const rows: Row[] = [
  { id: '1', name: '甲', status: 'active' },
  { id: '2', name: '乙', status: 'suspended' },
];
const query: TableQueryFn<Row> = async () => ({ rows, total: 2 });
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

function StorageProbe({
  storageKey,
  frames,
}: {
  storageKey: string;
  frames: Array<{ key: string; ready: boolean; value: string }>;
}) {
  const state = useSessionStorage({
    key: storageKey,
    schema: z.string(),
    defaultValue: '',
  });
  frames.push({ key: storageKey, ready: state.ready, value: state.value });
  return <span>{state.value}</span>;
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  window.matchMedia = vi.fn().mockImplementation((media) => ({
    matches: false,
    media,
    addEventListener() {},
    removeEventListener() {},
  }));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TableView 查询与交互回归', () => {
  it('恢复查询后的第一次修改保留恢复的 pageSize 和 sort', async () => {
    sessionStorage.setItem(
      'tv:q:v1:user:restore:[]',
      JSON.stringify({
        page: 2,
        pageSize: 50,
        q: '原词',
        filters: [],
        sort: [{ field: 'name', direction: SortDirection.Desc }],
      }),
    );
    const requested = vi.fn(query);
    render(
      <QueryClientProvider client={client()}>
        <TableView
          id="restore"
          identityKey="user"
          query={requested}
          columns={columns}
          rowKey={(row) => row.id}
          toolbar={{ searchable: { debounceMs: 5 }, sortable: true }}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(requested).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('搜索'));
    fireEvent.change(screen.getByLabelText('搜索表格'), {
      target: { value: '新词' },
    });
    await waitFor(() =>
      expect(requested.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        pageSize: 50,
        q: '新词',
        sort: [{ field: 'name', direction: SortDirection.Desc }],
      }),
    );
  });

  it('选中后仍可展开搜索，保留选择；修改搜索后清空选择', async () => {
    render(
      <QueryClientProvider client={client()}>
        <TableView
          id="modes"
          identityKey="user"
          query={query}
          columns={columns}
          rowKey={(row) => row.id}
          toolbar={{ searchable: { debounceMs: 5 } }}
          selection={{ enabled: true }}
        />
      </QueryClientProvider>,
    );
    await screen.findByText('甲');
    fireEvent.click(screen.getByLabelText('选择行 1'));
    expect(await screen.findByText('已选 1 项')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('搜索'));
    expect(screen.getByLabelText('搜索表格')).toBeTruthy();
    expect(screen.getByLabelText('选择行 1').getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.change(screen.getByLabelText('搜索表格'), {
      target: { value: '甲' },
    });
    await waitFor(() =>
      expect(
        screen.getByLabelText('选择行 1').getAttribute('aria-checked'),
      ).toBe('false'),
    );
  });

  it('只列出声明的筛选字段，条件自动应用而无应用按钮', async () => {
    const onQueryChange = vi.fn();
    render(
      <QueryClientProvider client={client()}>
        <TableView
          id="filter"
          identityKey="user"
          query={query}
          columns={columns}
          rowKey={(row) => row.id}
          toolbar={{ filterable: true }}
          onQueryChange={onQueryChange}
        />
      </QueryClientProvider>,
    );
    await screen.findByText('甲');
    fireEvent.click(screen.getByLabelText('筛选'));
    expect(screen.getByPlaceholderText('搜索筛选字段…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '名称' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '状态' }));
    expect(screen.queryByRole('button', { name: '应用' })).toBeNull();
    fireEvent.change(screen.getByLabelText('状态筛选值'), {
      target: { value: 'active' },
    });
    await waitFor(() =>
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'filter',
          next: expect.objectContaining({
            filters: [
              expect.objectContaining({ field: 'status', value: 'active' }),
            ],
          }),
        }),
      ),
    );
  });

  it('切换范围先恢复目标条件，不显示旧范围数据或发送默认条件', async () => {
    const saved = (q: string) =>
      JSON.stringify({ page: 1, pageSize: 50, q, filters: [], sort: [] });
    sessionStorage.setItem(
      `tv:q:v1:user:scoped:${tableScopeKey({ providerId: 'A' })}`,
      saved('AA'),
    );
    sessionStorage.setItem(
      `tv:q:v1:user:scoped:${tableScopeKey({ providerId: 'B' })}`,
      saved('BB'),
    );
    const requested = vi.fn<TableQueryFn<Row>>(async (params, context) => ({
      rows: [
        {
          id: '1',
          name: `${context.scope.providerId}:${params.q}`,
          status: 'active',
        },
      ],
      total: 1,
    }));
    const cache = client();
    const element = (providerId: string) => (
      <QueryClientProvider client={cache}>
        <TableView
          id="scoped"
          identityKey="user"
          scope={{ providerId }}
          columns={columns}
          rowKey={(row) => row.id}
          query={requested}
        />
      </QueryClientProvider>
    );
    const mounted = render(element('A'));
    await screen.findByText('A:AA');
    mounted.rerender(element('B'));
    expect(screen.queryByText('A:AA')).toBeNull();
    await screen.findByText('B:BB');
    expect(
      requested.mock.calls
        .filter((call) => call[1].scope.providerId === 'B')
        .map((call) => call[0].q),
    ).toEqual(['BB']);
  });

  it('动作通知回调抛错不阻止业务执行，也不误报业务失败', async () => {
    const diagnostic = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const execute = vi.fn(async () => undefined);
    const failure = vi.fn();
    render(
      <QueryClientProvider client={client()}>
        <TableView
          id="action-callback"
          identityKey="user"
          columns={columns}
          query={query}
          rowKey={(row) => row.id}
          toolbar={{ actions: [{ label: '测试动作', onRun: execute }] }}
          onActionStart={() => {
            throw new Error('observer failure');
          }}
          onActionSuccess={() => {
            throw new Error('observer failure');
          }}
          onActionError={failure}
        />
      </QueryClientProvider>,
    );
    await screen.findByText('甲');
    fireEvent.click(screen.getByRole('button', { name: '测试动作' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(failure).not.toHaveBeenCalled();
    diagnostic.mockRestore();
  });

  it('缓存命中不触发加载成功回调', async () => {
    const cache = client();
    const first = vi.fn();
    const element = (callback: () => void) => (
      <QueryClientProvider client={cache}>
        <TableView
          id="cache"
          identityKey="user"
          query={query}
          columns={columns}
          rowKey={(row) => row.id}
          onLoadSuccess={callback}
        />
      </QueryClientProvider>
    );
    const mounted = render(element(first));
    await screen.findByText('甲');
    expect(first).toHaveBeenCalledTimes(1);
    mounted.unmount();
    const second = vi.fn();
    render(element(second));
    await screen.findByText('甲');
    expect(second).not.toHaveBeenCalled();
  });
});

describe('通用存储和适配器', () => {
  it('范围序列化不混淆值类型、等号与分隔符', () => {
    expect(tableScopeKey({ value: 1 })).not.toBe(tableScopeKey({ value: '1' }));
    expect(tableScopeKey({ a: 'b&c=d' })).not.toBe(
      tableScopeKey({ a: 'b', c: 'd' }),
    );
  });

  it('切换存储 key 的首帧必须 ready=false，不能携带旧数据请求', async () => {
    sessionStorage.setItem('a', JSON.stringify('A'));
    sessionStorage.setItem('b', JSON.stringify('B'));
    const frames: Array<{ key: string; ready: boolean; value: string }> = [];

    const mounted = render(<StorageProbe storageKey="a" frames={frames} />);
    await screen.findByText('A');
    await act(async () =>
      mounted.rerender(<StorageProbe storageKey="b" frames={frames} />),
    );
    expect(frames.find((frame) => frame.key === 'b')).toEqual({
      key: 'b',
      ready: false,
      value: '',
    });
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('缺失分页载荷不得伪装成空结果', async () => {
    const request = vi.fn(async () => ({ data: undefined }));
    const adapter = createTableQuery({ request });
    await expect(
      adapter(
        { page: 1, pageSize: 20, q: '', filters: [], sort: [] },
        { signal: new AbortController().signal, scope: {} },
      ),
    ).rejects.toThrow('查询响应不符合分页契约');
  });
});
