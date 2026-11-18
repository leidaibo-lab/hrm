import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { SourceAdminService } from '../application/source-admin.service';
import type { SourceHealthService } from '../application/source-health.service';
import { SourceNameConflictError } from '../domain/connector.error';
import { SourceController } from '../source.controller';

class ConflictingAdminService {
  async create(): Promise<never> {
    throw new SourceNameConflictError('研发群');
  }
}

describe('SourceController.create', () => {
  it('名称冲突映射为 409', async () => {
    const controller = new SourceController(
      new ConflictingAdminService() as unknown as SourceAdminService,
      {} as SourceHealthService,
    );

    await expect(
      controller.create({
        sourceType: 'lark',
        name: '研发群',
        config: { chats: ['chat-1'] },
      }),
    ).rejects.toThrow(ConflictException);
  });
});
