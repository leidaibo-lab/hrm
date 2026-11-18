import { PostgresStore } from '@mastra/pg';
import { Logger } from '@nestjs/common';
import { env } from '../../../../config/env';

const logger = new Logger('MastraStorage');

/** 进程内共享的 Mastra 存储；首次使用时创建并初始化。 */
let store: PostgresStore | null = null;
/** 初始化中的 Promise；失败后清空以允许下次重试。 */
let initPromise: Promise<PostgresStore | undefined> | null = null;

/** 取已初始化的 Mastra 存储；不可用时返回 undefined，降级为内存。 */
export function getAgentStorage(): Promise<PostgresStore | undefined> {
  store ??= new PostgresStore({
    id: 'agentic',
    connectionString: env.DATABASE_URL,
  });
  initPromise ??= store
    .init()
    .then(() => store ?? undefined)
    .catch((error: unknown) => {
      logger.warn(
        `Mastra 存储初始化失败，降级为内存：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
      initPromise = null;
      return undefined;
    });
  return initPromise;
}
