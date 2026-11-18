import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/** worker 进程入口：常驻执行周期任务，不监听端口。 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();
}

void bootstrap().catch((error: unknown) => {
  console.error('[worker] 启动失败', error);
  process.exit(1);
});
