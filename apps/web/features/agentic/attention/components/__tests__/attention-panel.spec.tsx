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
import { AttentionPanel } from '../attention-panel';

const list = vi.fn();
const answer = vi.fn();

vi.mock('@/lib/api-client', () => ({
  attentionControllerList: (...args: unknown[]) => list(...args),
  attentionControllerAnswer: (...args: unknown[]) => answer(...args),
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
    createElement(
      QueryClientProvider,
      { client },
      createElement(AttentionPanel),
    ),
  );
}

describe('AttentionPanel', () => {
  it('切换类型后带 kind 查询', async () => {
    list.mockResolvedValue({
      data: {
        items: [
          {
            id: 'attention-1',
            ticketId: 'ticket-1',
            kind: 'clarify',
            question: '验收标准是什么？',
            status: 'open',
            deadline: null,
            decidedBy: null,
            decidedAt: null,
            answer: null,
          },
        ],
      },
    });

    renderPanel();

    await screen.findByText('验收标准是什么？');
    fireEvent.click(screen.getByRole('button', { name: '评审' }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: { kind: 'review' } }),
      ),
    );
  });

  it('修改时携带 decision 与修改说明', async () => {
    list.mockResolvedValue({
      data: {
        items: [
          {
            id: 'attention-1',
            ticketId: 'ticket-1',
            kind: 'clarify',
            question: '验收标准是什么？',
            status: 'open',
            deadline: null,
            decidedBy: null,
            decidedAt: null,
            answer: null,
          },
        ],
      },
    });
    answer.mockResolvedValue({ data: {} });

    renderPanel();

    await screen.findByText('验收标准是什么？');
    fireEvent.change(screen.getByPlaceholderText('输入回答，或填写驳回原因'), {
      target: { value: '补充导出失败场景' },
    });
    fireEvent.click(screen.getByRole('button', { name: '修改' }));

    await waitFor(() =>
      expect(answer).toHaveBeenCalledWith({
        path: { id: 'attention-1' },
        body: {
          answer: '补充导出失败场景',
          decision: 'modify',
        },
      }),
    );
  });

  it('驳回时携带 decision 与原因', async () => {
    list.mockResolvedValue({
      data: {
        items: [
          {
            id: 'attention-1',
            ticketId: 'ticket-1',
            kind: 'clarify',
            question: '验收标准是什么？',
            status: 'open',
            deadline: null,
            decidedBy: null,
            decidedAt: null,
            answer: null,
          },
        ],
      },
    });
    answer.mockResolvedValue({ data: {} });

    renderPanel();

    await screen.findByText('验收标准是什么？');
    fireEvent.change(screen.getByPlaceholderText('输入回答，或填写驳回原因'), {
      target: { value: '需求不成立' },
    });
    fireEvent.click(screen.getByRole('button', { name: '驳回' }));

    await waitFor(() =>
      expect(answer).toHaveBeenCalledWith({
        path: { id: 'attention-1' },
        body: {
          answer: '需求不成立',
          decision: 'reject',
          reason: '需求不成立',
        },
      }),
    );
  });
});
