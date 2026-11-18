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
import { SourcesPanel } from '../sources-panel';

const list = vi.fn();
const create = vi.fn();

vi.mock('@/lib/api-client', () => ({
  sourceControllerList: (...args: unknown[]) => list(...args),
  sourceControllerCreate: (...args: unknown[]) => create(...args),
  sourceControllerEnable: vi.fn(),
  sourceControllerDisable: vi.fn(),
  sourceControllerHealthOf: vi.fn(),
  sourceControllerUpdate: vi.fn(),
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
    createElement(QueryClientProvider, { client }, createElement(SourcesPanel)),
  );
}

describe('SourcesPanel', () => {
  it('创建时解析表格配置', async () => {
    list.mockResolvedValue({ data: { items: [] } });
    create.mockResolvedValue({ data: { id: 'source-1' } });

    renderPanel();

    fireEvent.change(await screen.findByPlaceholderText('来源名称'), {
      target: { value: '需求表' },
    });
    fireEvent.change(screen.getByPlaceholderText('群 ID，逗号分隔'), {
      target: { value: 'chat-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('机器人 open_id（必填）'), {
      target: { value: 'bot-1' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('表格 appToken:tableId，逗号分隔'),
      { target: { value: 'app:table,bad,:' } },
    );
    fireEvent.click(screen.getByRole('button', { name: '新建飞书来源' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        body: expect.objectContaining({
          name: '需求表',
          botId: 'bot-1',
          config: expect.objectContaining({
            chats: ['chat-1'],
            tables: [{ appToken: 'app', tableId: 'table' }],
          }),
        }),
      }),
    );
  });
});
