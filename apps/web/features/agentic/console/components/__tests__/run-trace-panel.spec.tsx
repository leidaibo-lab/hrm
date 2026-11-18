// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunTracePanel } from '../run-trace-panel';

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
    createElement(
      QueryClientProvider,
      { client },
      createElement(RunTracePanel),
    ),
  );
}

describe('RunTracePanel', () => {
  it('展示运行步骤、用量、授权与产物', async () => {
    list.mockResolvedValue({
      data: {
        items: [
          {
            id: 'audit-1',
            traceId: 'trace-1',
            actorId: null,
            action: 'agentic.run',
            method: 'WORKER',
            path: 'clarify',
            statusCode: 200,
            detail: {
              ticketId: 'ticket-1',
              role: 'clarify',
              mandateId: 'mandate-1',
              policyVersion: 3,
              result: 'succeeded',
              durationMs: 1500,
              tokens: 800,
              steps: ['read-ticket', 'read-document'],
              toolCalls: [
                {
                  name: 'read-document',
                  input: { path: 'docs/prd.md' },
                  output: { summary: '已读取' },
                },
              ],
              artifactId: 'artifact-1',
              artifactKind: 'clarify',
              artifactVersion: 2,
            },
            createdAt: '2026-11-16T00:00:00.000Z',
          },
        ],
      },
    });

    renderPanel();

    await screen.findByText('read-ticket');
    expect(screen.getAllByText('read-document').length).toBeGreaterThan(0);
    expect(screen.getByText('1.5s')).toBeDefined();
    expect(screen.getByText('800 tokens')).toBeDefined();
    expect(screen.getAllByText('read-document').length).toBeGreaterThan(0);
    expect(screen.getByText('mandate-1')).toBeDefined();
    expect(screen.getByText(/策略 v3/)).toBeDefined();
    expect(screen.getByText('artifact-1')).toBeDefined();
    expect(screen.getByText(/clarify v2/)).toBeDefined();
  });
});
