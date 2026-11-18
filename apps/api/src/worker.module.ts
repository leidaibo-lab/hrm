import { Module } from '@nestjs/common';
import { AgenticModule } from './modules/agentic/agentic.module';
import { AttentionSchedulerService } from './modules/agentic/application/attention-scheduler.service';
import { BreakdownWorkerService } from './modules/agentic/application/breakdown-worker.service';
import { ClarificationWorkerService } from './modules/agentic/application/clarification-worker.service';
import { NotificationWorkerService } from './modules/connector/application/notification-worker.service';
import { OutboundSchedulerService } from './modules/connector/application/outbound-scheduler.service';
import { RoutingWorkerService } from './modules/connector/application/routing-worker.service';
import { TablePollSchedulerService } from './modules/connector/application/table-poll-scheduler.service';
import { ConnectorModule } from './modules/connector/connector.module';
import { ModelGatewayModule } from './modules/model-gateway/model-gateway.module';
import { CryptoModule } from './platform/crypto';
import { HttpModule } from './platform/http';
import { PrismaModule } from './platform/prisma';
import { QueueModule } from './platform/queue';
import { RedisModule } from './platform/redis';

/**
 * worker 进程模块：只装配后台周期任务，不暴露 HTTP。
 * api 与 worker 共用同一镜像，分别以 main.ts / worker.ts 启动。
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    QueueModule,
    HttpModule,
    CryptoModule,
    AgenticModule,
    ConnectorModule,
    ModelGatewayModule,
  ],
  providers: [
    OutboundSchedulerService,
    AttentionSchedulerService,
    BreakdownWorkerService,
    ClarificationWorkerService,
    NotificationWorkerService,
    RoutingWorkerService,
    TablePollSchedulerService,
  ],
})
export class WorkerModule {}
