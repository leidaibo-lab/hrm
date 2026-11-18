import { describe, expect, it } from 'vitest';
import { createReadDocumentTool } from '../read-document.tool';

describe('read-document tool', () => {
  it('权限不足时抛错且不返回正文', async () => {
    const tool = createReadDocumentTool({
      authorize: async () => false,
    });
    await expect(
      tool.execute?.(
        { document: 'https://example.feishu.cn/docx/xxx' },
        undefined as never,
      ),
    ).rejects.toThrow('权限不足');
  });

  it('V0 未接入文档读取时返回原因，不猜测正文', async () => {
    const tool = createReadDocumentTool();
    const result = await tool.execute?.(
      { document: 'https://example.feishu.cn/docx/xxx' },
      undefined as never,
    );

    expect(result).toMatchObject({
      available: false,
      content: null,
    });
    expect((result as { reason: string }).reason).toContain('补充正文');
  });
});
