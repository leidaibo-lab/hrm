// @vitest-environment jsdom

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
import { TicketsPanel } from '../tickets-panel';

const list = vi.fn();

vi.mock('@/lib/api-client', () => ({
  ticketControllerList: (...args: unknown[]) => list(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    createElement(QueryClientProvider, { client }, createElement(TicketsPanel)),
  );
}

describe('TicketsPanel', () => {
  it('切换状态后带 status 查询', async () => {
    list.mockResolvedValue({
      data: {
        items: [
          {
            id: 'ticket-1',
            threadId: 'thread-1',
            kind: 'requirement',
            status: 'open',
            scopeKey: 'chat-1',
            openedAt: '2026-11-16T00:00:00.000Z',
            endedAt: null,
            endReason: null,
          },
        ],
      },
    });

    renderPanel();

    await screen.findByText('ticket-1');
    fireEvent.click(screen.getByRole('button', { name: '已结束' }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: { limit: 50, status: 'ended' },
        }),
      ),
    );
  });

  it('按项目筛选时带 scopeKey', async () => {
    list.mockResolvedValue({ data: { items: [] } });
    renderPanel();

    const input = await screen.findByLabelText('按项目筛选');
    fireEvent.change(input, {
      target: { value: 'chat-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '筛选项目' }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: { limit: 50, scopeKey: 'chat-1' },
        }),
      ),
    );
  });
});
