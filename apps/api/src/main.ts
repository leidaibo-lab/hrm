import 'reflect-metadata';
import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {DatabaseService} from './database.service.js';
import {HealthController} from './health.controller.js';

/** 装配独立业务API；Mastra编排继续由ai-platform负责。 */
@Module({controllers: [HealthController], providers: [DatabaseService]})
class ApplicationModule {}

/** 启动API并注册关闭钩子，端口必须是合法TCP端口。 */
async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT无效');
  const app = await NestFactory.create(ApplicationModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

// 启动失败只返回固定诊断，避免原始异常泄露服务端配置。
main().catch(() => { console.error('HRM API启动失败，请检查服务端配置。'); process.exitCode = 1; });
