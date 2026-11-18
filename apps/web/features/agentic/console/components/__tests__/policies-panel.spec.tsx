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
import { PoliciesPanel } from '../policies-panel';

const current = vi.fn();
const publish = vi.fn();
const admissionRules = vi.fn();
const publishAdmission = vi.fn();
const sources = vi.fn();

vi.mock('@/lib/api-client', () => ({
  policyControllerCurrent: (...args: unknown[]) => current(...args),
  policyControllerPublish: (...args: unknown[]) => publish(...args),
  policyControllerAdmissionRules: (...args: unknown[]) =>
    admissionRules(...args),
  policyControllerPublishAdmissionRules: (...args: unknown[]) =>
    publishAdmission(...args),
  sourceControllerList: (...args: unknown[]) => sources(...args),
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
      createElement(PoliciesPanel),
    ),
  );
}

describe('PoliciesPanel', () => {
  it('发布时携带回放脱敏字段', async () => {
    current.mockResolvedValue({
      data: {
        policy: {
          id: 'policy-1',
          version: 1,
          acceptMode: 'explicit',
          rules: { auditRedactFields: ['phone'] },
          createdBy: 'admin',
          createdAt: '2026-11-16T00:00:00.000Z',
        },
      },
    });
    publish.mockResolvedValue({ data: { version: 2 } });
    admissionRules.mockResolvedValue({ data: { items: [] } });
    sources.mockResolvedValue({
      data: { items: [{ id: 'source-1', name: '研发群' }] },
    });

    renderPanel();

    const input = await screen.findByLabelText('回放脱敏字段');
    expect((input as HTMLInputElement).value).toBe('phone');
    fireEvent.change(input, { target: { value: 'phone,email' } });
    fireEvent.click(screen.getByRole('button', { name: '发布新版本' }));

    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith({
        body: {
          acceptMode: 'explicit',
          rules: { auditRedactFields: ['phone', 'email'] },
        },
      }),
    );
  });

  it('选择来源后添加准入规则', async () => {
    current.mockResolvedValue({
      data: {
        policy: {
          id: 'policy-1',
          version: 1,
          acceptMode: 'explicit',
          rules: {},
          createdBy: 'admin',
          createdAt: '2026-11-16T00:00:00.000Z',
        },
      },
    });
    admissionRules.mockResolvedValue({ data: { items: [] } });
    sources.mockResolvedValue({
      data: { items: [{ id: 'source-1', name: '研发群' }] },
    });
    publishAdmission.mockResolvedValue({ data: { items: [] } });

    renderPanel();

    const sourceSelect = await screen.findByLabelText('来源实例');
    fireEvent.change(sourceSelect, { target: { value: 'source-1' } });
    fireEvent.change(screen.getByLabelText('范围行'), {
      target: { value: 'chat-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加规则' }));

    await waitFor(() =>
      expect(publishAdmission).toHaveBeenCalledWith({
        path: { id: 'policy-1' },
        body: {
          rules: [
            {
              sourceInstanceId: 'source-1',
              scopeRow: 'chat-1',
              cell: 'listed_unaddressed',
              allowed: true,
            },
          ],
        },
      }),
    );
  });
});
