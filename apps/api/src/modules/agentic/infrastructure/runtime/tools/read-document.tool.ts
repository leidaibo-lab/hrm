import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** 文档读取结果 schema。 */
const readDocumentOutputSchema = z.object({
  /** 是否读到正文。 */
  available: z.boolean(),
  /** 文档正文；不可读时为 null。 */
  content: z.string().nullable(),
  /** 不可读原因；可读时为 null。 */
  reason: z.string().nullable(),
});

/**
 * 读取关联文档工具：V0 尚未接入飞书云文档读取能力。
 * 按 PRD §7.2 F3 的降级约定，读不到文档时不猜测，返回原因由角色要求补充正文。
 * 接入文档读取适配器后只需替换 execute，工具标识与 schema 不变。
 */
export interface ReadDocumentToolDeps {
  /** 工具级有效权限校验；缺省不校验（仅测试/系统内部）。 */
  authorize?: (tool: string) => Promise<boolean>;
}

/** 读取文档工具：只读已登记文档摘要。 */
export function createReadDocumentTool(deps: ReadDocumentToolDeps = {}) {
  return createTool({
    id: 'read-document',
    description: '读取需求关联文档正文；V0 未接入时返回不可读原因。',
    inputSchema: z.object({
      /** 文档标识或链接。 */
      document: z.string().min(1),
    }),
    outputSchema: readDocumentOutputSchema,
    execute: async () => {
      if (deps.authorize && !(await deps.authorize('read-document')))
        throw new Error('工具权限不足：read-document');
      return {
        available: false,
        content: null,
        reason: 'V0 未接入云文档读取，请让提出人补充正文',
      };
    },
  });
}
