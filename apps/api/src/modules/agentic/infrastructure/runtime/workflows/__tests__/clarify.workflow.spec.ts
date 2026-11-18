import { describe, expect, it } from 'vitest';
import type { ClarifyAgentOutput } from '../../agents/clarify.agent';
import {
  type ClarifyWorkflowDeps,
  createClarifyWorkflow,
  toClarifyBranchOutput,
} from '../clarify.workflow';

function deps(options: {
  output?: ClarifyAgentOutput;
  score?: number;
  loadError?: Error;
}): ClarifyWorkflowDeps {
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
        summary: '澄清摘要内容足够长以通过长度检查',
        draft: { goal: '导出报表' },
        questions: [{ question: '导出字段范围如何确定？', options: null }],
      },
    score: async () => options.score ?? 0.9,
  };
}

async function run(workflowDeps: ClarifyWorkflowDeps) {
  const workflow = createClarifyWorkflow(workflowDeps);
  const runInstance = await workflow.createRun();
  return runInstance.start({
    inputData: { ticketId: 'ticket-1', threadId: 'thread-1' },
  });
}

describe('clarify workflow', () => {
  it('按步骤产出草稿、评分与人工分支标记', async () => {
    const result = await run(deps({ score: 0.9 }));

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    const output = toClarifyBranchOutput(result.result);
    if (!output) throw new Error('缺少澄清分支输出');
    expect(output.summary).toContain('澄清摘要');
    expect(output.score).toBe(0.9);
    expect(output.needsHuman).toBe(false);
    expect(output.route).toBe('persist');
  });

  it('低于阈值标记人工分支', async () => {
    const result = await run(deps({ score: 0.4 }));

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    const output = toClarifyBranchOutput(result.result);
    if (!output) throw new Error('缺少澄清分支输出');
    expect(output.needsHuman).toBe(true);
    expect(output.route).toBe('attention');
  });

  it('上下文装载失败时工作流失败', async () => {
    const result = await run(deps({ loadError: new Error('策略缺失') }));

    expect(result.status).toBe('failed');
  });
});
