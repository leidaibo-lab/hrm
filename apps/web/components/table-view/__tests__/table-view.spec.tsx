// @vitest-environment jsdom

import { FilterOperator, SortDirection } from '@cip/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createColumns, TableView, type TableViewHandle } from '../index';
import type { TableQuery, TableQueryFn } from '../types';

interface Row {
  id: string;
  name: string;
  status: string;
}

class ResizeObserverMock {
  observe: typeof ResizeObserver.prototype.observe = () => undefined;
  unobserve: typeof ResizeObserver.prototype.unobserve = () => undefined;
  disconnect: typeof ResizeObserver.prototype.disconnect = () => undefined;
}

if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    window.ResizeObserver =
      ResizeObserverMock as unknown as typeof ResizeObserver;
  }
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
}

const rows: Row[] = [
  { id: 'r1', name: '甲', status: 'active' },
  { id: 'r2', name: '乙', status: 'suspended' },
  { id: 'r3', name: '丙', status: 'active' },
];

const tableColumns = createColumns<Row>(({ primary, text }) => [
  primary('name', '名称', { width: 200, sortable: true }),
  text('status', '状态', {
    filter: {
      operators: [FilterOperator.Equal, FilterOperator.NotEqual],
    },
  }),
]);

const tableQuery: TableQueryFn<Row> = async (query: TableQuery) => ({
  rows: rows.slice(
    Math.max(0, (query.page - 1) * query.pageSize),
    query.page * query.pageSize,
  ),
  total: rows.length,
});

function renderTable(overrides?: {
  query?: TableQueryFn<Row>;
  onQueryChange?: (event: { reason: string }) => void;
  onSelectionChange?: (event: { ids: string[]; reason: string }) => void;
  selection?: {
    enabled: boolean;
    actions?: import('../types').BulkAction<Row>[];
  };
  ref?: (value: TableViewHandle | null) => void;
  onLoadSuccess?: (event: unknown) => void;
  defaultQuery?: { pageSize: number };
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(TableView<Row>, {
        id: 'test-table',
        identityKey: 'u1',
        query: overrides?.query ?? tableQuery,
        columns: tableColumns,
        rowKey: (row: Row) => row.id,
        title: '测试表',
        toolbar: {
          searchable: { placeholder: '搜索…', debounceMs: 10 },
          filterable: true,
          sortable: { maxRules: 3 },
          columnSettings: true,
        },
        selection: overrides?.selection ?? { enabled: true },
        defaultQuery: overrides?.defaultQuery,
        onQueryChange: overrides?.onQueryChange,
        onSelectionChange: overrides?.onSelectionChange,
        onLoadSuccess: overrides?.onLoadSuccess,
        ref: overrides?.ref,
      }),
    ),
  );
  return { ...utils, client };
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('TableView 组件行为', () => {
  it('加载数据并触发 onLoadSuccess（cache hit 不重复触发）', async () => {
    const onLoadSuccess = vi.fn();
    renderTable({ onLoadSuccess });
    await waitFor(() => {
      expect(screen.getByText('甲')).toBeTruthy();
      expect(screen.getByText('乙')).toBeTruthy();
    });
    await waitFor(() => expect(onLoadSuccess).toHaveBeenCalledTimes(1));
    expect(onLoadSuccess.mock.calls[0][0].data.rows).toHaveLength(3);
  });

  it('搜索 debounce 后提交；清除按钮直接提交空值', async () => {
    const onQueryChange = vi.fn();
    renderTable({ onQueryChange });
    await waitFor(() => expect(screen.getByLabelText('搜索')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('搜索'));
    const input = await screen.findByPlaceholderText('搜索…');
    fireEvent.change(input, { target: { value: '甲' } });
    await waitFor(
      () => {
        const searchEvents = onQueryChange.mock.calls.filter(
          (call) => call[0].reason === 'search',
        );
        expect(searchEvents).toHaveLength(1);
        expect(searchEvents[0][0].next.q).toBe('甲');
        expect(searchEvents[0][0].next.page).toBe(1);
      },
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByLabelText('清除搜索'));
    await waitFor(() => {
      const searchEvents = onQueryChange.mock.calls.filter(
        (call) => call[0].reason === 'search',
      );
      expect(searchEvents).toHaveLength(2);
      expect(searchEvents[1][0].next.q).toBe('');
    });
  });

  it('输入法 composition 期间不提交搜索', async () => {
    const onQueryChange = vi.fn();
    renderTable({ onQueryChange });
    await waitFor(() => expect(screen.getByLabelText('搜索')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('搜索'));
    const input = await screen.findByPlaceholderText('搜索…');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'zhang' } });
    await new Promise((resolve) => setTimeout(resolve, 60));
    const searchEvents = onQueryChange.mock.calls.filter(
      (call) => call[0].reason === 'search',
    );
    expect(searchEvents).toHaveLength(0);
    fireEvent.compositionEnd(input);
    await waitFor(
      () => {
        const afterEvents = onQueryChange.mock.calls.filter(
          (call) => call[0].reason === 'search',
        );
        expect(afterEvents).toHaveLength(1);
        expect(afterEvents[0][0].next.q).toBe('zhang');
      },
      { timeout: 2000 },
    );
  });

  it('翻页产生 reason page 的 onQueryChange 并清空选择', async () => {
    const onQueryChange = vi.fn();
    const onSelectionChange = vi.fn();
    // 12 行数据 × pageSize 10 → 2 页（白名单 pageSize 规范合法值）
    const manyRows: Row[] = Array.from({ length: 12 }, (_, index) => ({
      id: `r${index + 1}`,
      name: `行${index + 1}`,
      status: 'active',
    }));
    const pagedQuery: TableQueryFn<Row> = async (query: TableQuery) => ({
      rows: manyRows.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize,
      ),
      total: manyRows.length,
    });
    renderTable({
      query: pagedQuery,
      onQueryChange,
      onSelectionChange,
      defaultQuery: { pageSize: 10 },
    });
    await waitFor(() => expect(screen.getByText('行1')).toBeTruthy());
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ ids: ['r1'], reason: 'row' }),
      );
    });
    const nextButton = screen.getByLabelText('下一页');
    expect((nextButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(nextButton);
    await waitFor(() => {
      const pageEvents = onQueryChange.mock.calls.filter(
        (call) => call[0].reason === 'page',
      );
      if (pageEvents.length === 0) {
        throw new Error(
          `尚未触发 page 事件；现有事件: ${JSON.stringify(onQueryChange.mock.calls.map((call) => call[0].reason))}`,
        );
      }
      expect(pageEvents).toHaveLength(1);
      expect(pageEvents[0][0].next.page).toBe(2);
    });
    const clearCall = onSelectionChange.mock.calls.find(
      (call) => call[0].reason === 'query',
    );
    expect(clearCall).toBeTruthy();
    expect(clearCall?.[0].ids).toEqual([]);
  });

  it('列布局变化不发查询', async () => {
    const queryFn = vi.fn(tableQuery);
    renderTable({ query: queryFn as TableQueryFn<Row> });
    await waitFor(() => expect(screen.getByText('甲')).toBeTruthy());
    const callsAfterLoad = queryFn.mock.calls.length;
    fireEvent.click(screen.getByLabelText('列设置'));
    await waitFor(() => expect(screen.getByText('列设置')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('隐藏 状态'));
    await waitFor(() => {
      expect(
        window.localStorage.getItem('tv:cols:v1:u1:test-table:[]'),
      ).toContain('"status"');
    });
    expect(queryFn.mock.calls.length).toBe(callsAfterLoad);
  });

  it('批量动作部分失败：成功项取消选中，失败项保留并报告', async () => {
    const onSelectionChange = vi.fn();
    const onActionSuccess = vi.fn();
    const rows2: Row[] = [
      { id: 'r1', name: '甲', status: 'active' },
      { id: 'r2', name: '乙', status: 'active' },
    ];
    const partialQuery: TableQueryFn<Row> = async () => ({
      rows: rows2,
      total: 2,
    });
    const bulkAction = {
      label: '批量处理',
      onRun: async (selected: readonly Row[]) => ({
        succeededIds: [selected[0]?.id ?? ''],
        failed: [
          {
            id: selected[1]?.id ?? '',
            error: { message: '第二个失败', code: 'test.failed' },
          },
        ],
      }),
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(TableView<Row>, {
          id: 'bulk-table',
          identityKey: 'u1',
          query: partialQuery,
          columns: tableColumns,
          rowKey: (row: Row) => row.id,
          title: '批量',
          selection: { enabled: true, actions: [bulkAction] },
          onSelectionChange,
          onActionSuccess,
        }),
      ),
    );
    await waitFor(() => expect(screen.getByText('甲')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('全选当前页'));
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ ids: ['r1', 'r2'], reason: 'all' }),
      );
    });
    fireEvent.click(screen.getByRole('button', { name: '批量处理' }));
    await waitFor(() => {
      expect(onActionSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          label: '批量处理',
          scope: 'bulk',
          rowIds: ['r1', 'r2'],
          result: expect.objectContaining({ succeededIds: ['r1'] }),
        }),
      );
    });
    const lastSelection =
      onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0];
    expect(lastSelection.reason).toBe('action');
    expect(lastSelection.ids).toEqual(['r2']);
  });

  it('ref 句柄：getQuery/resetQuery/resetColumns', async () => {
    const refBox: { current: TableViewHandle | null } = { current: null };
    const onQueryChange = vi.fn();
    renderTable({
      ref: (value: TableViewHandle | null) => {
        refBox.current = value;
      },
      onQueryChange,
    });
    await waitFor(() => {
      expect(refBox.current?.getQuery()).toBeTruthy();
      expect(refBox.current?.getQuery().page).toBe(1);
    });
    refBox.current?.resetQuery();
    await waitFor(() => {
      const resetEvent = onQueryChange.mock.calls.find(
        (call) => call[0].reason === 'reset',
      );
      expect(resetEvent).toBeTruthy();
    });
    window.localStorage.setItem(
      'tv:cols:v1:u1:test-table:[]',
      '{"version":1,"order":[],"widths":{},"hidden":["status"],"frozen":[]}',
    );
    refBox.current?.resetColumns();
    await waitFor(() => {
      expect(
        window.localStorage.getItem('tv:cols:v1:u1:test-table:[]'),
      ).toBeNull();
    });
  });

  it('defaultQuery 默认排序经 SortDirection 引用生效', async () => {
    const refBox: { current: TableViewHandle | null } = { current: null };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(TableView<Row>, {
          id: 'sort-table',
          identityKey: 'u1',
          query: tableQuery,
          columns: tableColumns,
          rowKey: (row: Row) => row.id,
          defaultQuery: {
            sort: [{ field: 'name', direction: SortDirection.Desc }],
          },
          ref: (value: TableViewHandle | null) => {
            refBox.current = value;
          },
        }),
      ),
    );
    await waitFor(() => expect(refBox.current?.getQuery()).toBeTruthy());
    expect(refBox.current?.getQuery().sort).toEqual([
      { field: 'name', direction: SortDirection.Desc },
    ]);
  });
});
