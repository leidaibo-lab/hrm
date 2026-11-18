import { describe, expect, it } from 'vitest';
import type { BreakdownAgentOutput } from '../../agents/breakdown.agent';
import {
  type BreakdownWorkflowDeps,
  createBreakdownWorkflow,
} from '../breakdown.workflow';

function deps(options: {
  output?: BreakdownAgentOutput;
  loadError?: Error;
}): BreakdownWorkflowDeps {
  return {
    loadContext: async (input) => {
      if (options.loadError) throw options.loadError;
      return {
        ticketId: input.ticketId,
        threadId: input.threadId,
        prompt: 'prompt',
      };
    },
    generate: async () =>
      options.output ?? {
        summary: '拆解说明',
        tasks: [
          {
            title: '实现导出',
            description: '按筛选条件导出',
            dependsOn: null,
            owner: null,
          },
        ],
      },
  };
}

async function run(workflowDeps: BreakdownWorkflowDeps) {
  const workflow = createBreakdownWorkflow(workflowDeps);
  const runInstance = await workflow.createRun();
  return runInstance.start({
    inputData: { ticketId: 'ticket-1', threadId: 'thread-1' },
  });
}

describe('breakdown workflow', () => {
  it('按步骤产出任务草稿', async () => {
    const result = await run(deps({}));

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result.tasks).toHaveLength(1);
    expect(result.result.tasks[0].title).toBe('实现导出');
    expect(result.result.summary).toBe('拆解说明');
  });

  it('上下文装载失败时工作流失败', async () => {
    const result = await run(deps({ loadError: new Error('策略缺失') }));
    expect(result.status).toBe('failed');
  });
});
