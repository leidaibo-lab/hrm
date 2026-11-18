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
import { AuditPanel } from '../audit-panel';

const list = vi.fn();

vi.mock('@/lib/api-client', () => ({
  auditControllerList: (...args: unknown[]) => list(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    createElement(QueryClientProvider, { client }, createElement(AuditPanel)),
  );
}

describe('AuditPanel', () => {
  it('展示记录并按动作筛选', async () => {
    list.mockResolvedValue({
      data: {
        items: [
          {
            id: 'audit-1',
            traceId: 'trace-1',
            actorId: 'user-1',
            action: 'ticket.end',
            method: 'POST',
            path: '/api/v1/agentic/tickets/1/end',
            statusCode: 200,
            detail: {},
            createdAt: '2026-11-16T00:00:00.000Z',
          },
        ],
      },
    });

    renderPanel();

    await screen.findByText('ticket.end');
    fireEvent.change(screen.getByLabelText('按动作筛选'), {
      target: { value: 'ticket.end' },
    });
    fireEvent.click(screen.getByRole('button', { name: '筛选' }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: { limit: 100, action: 'ticket.end' },
        }),
      ),
    );
  });
});
