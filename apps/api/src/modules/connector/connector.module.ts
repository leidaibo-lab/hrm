import { Module } from '@nestjs/common';
import { AgenticModule } from '../agentic/agentic.module';
import { IngressService } from './application/ingress.service';
import { OutboundService } from './application/outbound.service';
import { OutboundDispatcherService } from './application/outbound-dispatcher.service';
import {
  OUTBOUND_TRANSPORT_REGISTRY,
  OutboundTransportRegistry,
} from './application/outbound-transport.service';
import { SourceAdminService } from './application/source-admin.service';
import { SourceAuthorizationService } from './application/source-authorization.service';
import { SourceHealthService } from './application/source-health.service';
import {
  SOURCE_REGISTRY,
  SourceRegistry,
} from './application/source-registry.service';
import { TablePollService } from './application/table-poll.service';
import { INGRESS_RATE_LIMIT } from './domain/ingress-rate-limit.port';
import { OUTBOUND_FAILURE_COUNTER } from './domain/outbound-failure-counter.port';
import { OUTBOUND_MESSAGE_REPOSITORY } from './domain/outbound-message.repository';
import { OUTBOUND_RATE_LIMIT } from './domain/outbound-rate-limit.port';
import { ROUTING_QUEUE } from './domain/routing-queue.port';
import type { SourceAdapter } from './domain/source-adapter.port';
import { SOURCE_AUTHORIZATION_REPOSITORY } from './domain/source-authorization.repository';
import { SOURCE_CURSOR_REPOSITORY } from './domain/source-cursor.repository';
import { SOURCE_HEALTH_REPOSITORY } from './domain/source-health.repository';
import { SOURCE_INSTANCE_REPOSITORY } from './domain/source-instance.repository';
import { TABLE_RECORD_READER } from './domain/table-record.port';
import { IngressRateLimitService } from './infrastructure/ingress-rate-limit.service';
import { LarkSource } from './infrastructure/lark/source.service';
import { LarkTableReader } from './infrastructure/lark/table-reader.service';
import { LarkTokenService } from './infrastructure/lark/token.service';
import { LarkOutboundTransport } from './infrastructure/lark/transport.service';
import { OutboundFailureCounterService } from './infrastructure/outbound-failure-counter.service';
import { OutboundMessagePrismaRepository } from './infrastructure/outbound-message.prisma.repository';
import { OutboundRateLimitService } from './infrastructure/outbound-rate-limit.service';
import { RoutingQueueService } from './infrastructure/routing-queue.service';
import { SourceAuthorizationPrismaRepository } from './infrastructure/source-authorization.prisma.repository';
import { SourceCursorPrismaRepository } from './infrastructure/source-cursor.prisma.repository';
import { SourceHealthPrismaRepository } from './infrastructure/source-health.prisma.repository';
import { SourceInstancePrismaRepository } from './infrastructure/source-instance.prisma.repository';
import { LarkController } from './lark.controller';
import { SourceController } from './source.controller';
import { SourceAuthorizationController } from './source-authorization.controller';

/**
 * connector 域：外部系统接入。
 * 适配器按类型注册；接入用例只依赖 agentic 导出的 IngestionService。
 */
@Module({
  imports: [AgenticModule],
  controllers: [
    LarkController,
    SourceController,
    SourceAuthorizationController,
  ],
  providers: [
    LarkSource,
    LarkTokenService,
    LarkTableReader,
    LarkOutboundTransport,
    {
      provide: SOURCE_REGISTRY,
      useFactory: (lark: LarkSource) => {
        const registry = new SourceRegistry();
        registry.register(lark as unknown as SourceAdapter<unknown>);
        return registry;
      },
      inject: [LarkSource],
    },
    IngressService,
    SourceAdminService,
    SourceAuthorizationService,
    SourceHealthService,
    TablePollService,
    OutboundService,
    OutboundDispatcherService,
    { provide: ROUTING_QUEUE, useClass: RoutingQueueService },
    { provide: INGRESS_RATE_LIMIT, useClass: IngressRateLimitService },
    { provide: OUTBOUND_RATE_LIMIT, useClass: OutboundRateLimitService },
    {
      provide: OUTBOUND_FAILURE_COUNTER,
      useClass: OutboundFailureCounterService,
    },
    {
      provide: OUTBOUND_TRANSPORT_REGISTRY,
      useFactory: (lark: LarkOutboundTransport) => {
        const registry = new OutboundTransportRegistry();
        registry.register(lark);
        return registry;
      },
      inject: [LarkOutboundTransport],
    },
    {
      provide: SOURCE_INSTANCE_REPOSITORY,
      useClass: SourceInstancePrismaRepository,
    },
    {
      provide: SOURCE_AUTHORIZATION_REPOSITORY,
      useClass: SourceAuthorizationPrismaRepository,
    },
    {
      provide: SOURCE_HEALTH_REPOSITORY,
      useClass: SourceHealthPrismaRepository,
    },
    { provide: TABLE_RECORD_READER, useClass: LarkTableReader },
    {
      provide: SOURCE_CURSOR_REPOSITORY,
      useClass: SourceCursorPrismaRepository,
    },
    {
      provide: OUTBOUND_MESSAGE_REPOSITORY,
      useClass: OutboundMessagePrismaRepository,
    },
  ],
  exports: [
    IngressService,
    OutboundService,
    OutboundDispatcherService,
    TablePollService,
    SourceHealthService,
  ],
})
export class ConnectorModule {}
