import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { env } from './config/env';
import { AgenticModule } from './modules/agentic/agentic.module';
import { SessionGuard } from './modules/auth/auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { ConnectorModule } from './modules/connector/connector.module';
import { HealthModule } from './modules/health/health.module';
import { IamModule } from './modules/iam/iam.module';
import { ModelGatewayModule } from './modules/model-gateway/model-gateway.module';
import { ModelProvidersModule } from './modules/model-providers/model-providers.module';
import { AuditInterceptor } from './pipeline/audit';
import { CallContextInterceptor } from './pipeline/call-context';
import { OriginGuard, PoliciesGuard } from './pipeline/guards';
import { RateLimitModule } from './pipeline/rate-limit';
import { CryptoModule } from './platform/crypto';
import { HttpModule } from './platform/http';
import { PrismaModule } from './platform/prisma';
import { QueueModule } from './platform/queue';
import { RedisModule } from './platform/redis';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        // traceId 贯穿：优先复用上游 x-request-id，否则生成并回写响应头
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id =
            typeof existing === 'string' && existing ? existing : randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        level: env.LOG_LEVEL,
        // 开发单行彩色输出；生产保持 JSON 结构化（LOG_PRETTY=false 时不挂 transport）
        transport: env.LOG_PRETTY
          ? {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                colorize: true,
                translateTime: 'SYS:HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
        autoLogging: {
          // 探针流量不产生请求日志
          ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
        },
      },
    }),
    PrismaModule,
    RateLimitModule,
    RedisModule,
    CryptoModule,
    HttpModule,
    QueueModule,
    IamModule,
    ModelGatewayModule,
    ModelProvidersModule,
    AgenticModule,
    ConnectorModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CallContextInterceptor },
    // guard 顺序即注册顺序：CSRF 来源校验 → 认证 → 授权
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
  ],
})
export class AppModule {}
