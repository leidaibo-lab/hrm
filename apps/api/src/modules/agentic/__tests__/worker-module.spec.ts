import { Test } from '@nestjs/testing';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../platform/prisma';
import { QueueService } from '../../../platform/queue';
import { RedisService } from '../../../platform/redis';
import { WorkerModule } from '../../../worker.module';

/**
 * worker 进程的依赖图冒烟测试：确保 WorkerModule 能完成依赖注入。
 * 外部连接全部替换为最小假实现，不访问真实 DB/Redis。
 */
describe('WorkerModule 依赖装配', () => {
  let app: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  > | null = null;

  afterAll(async () => {
    await app?.close();
  });

  it('能完成模块编译与初始化', async () => {
    const fakeRedis = {
      withClient: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> =>
        fn({
          multi: () => ({
            incr: () => ({ expire: () => ({ exec: async () => [] }) }),
          }),
          del: async () => 1,
        }),
    };
    const fakeQueue = {
      createWorker: () => ({ close: async () => undefined }),
      enqueue: async () => 'job-1',
    };

    app = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue(fakeRedis)
      .overrideProvider(QueueService)
      .useValue(fakeQueue)
      .compile();
    await app.init();

    expect(app).toBeDefined();
  });
});
