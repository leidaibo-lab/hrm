import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { QueueService } from '../../../platform/queue';
import { RoutingService } from '../../agentic/application/routing.service';
import {
  ROUTING_QUEUE_NAME,
  type RoutingJob,
} from '../domain/routing-queue.port';

/** 事件路由消费者：在 worker 内异步执行准入与研判，避免阻塞回调。 */
@Injectable()
export class RoutingWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: ReturnType<QueueService['createWorker']> | null = null;

  constructor(
    private readonly queue: QueueService,
    private readonly routing: RoutingService,
  ) {}

  /** 注册消费者。 */
  onModuleInit(): void {
    this.worker = this.queue.createWorker<RoutingJob>(
      ROUTING_QUEUE_NAME,
      (job) => this.handle(job.data),
      2,
    );
  }

  /** 关闭消费者。 */
  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  /** 处理一条路由任务；事件已处置或缺失时跳过。 */
  async handle(job: RoutingJob): Promise<void> {
    await this.routing.routeTrigger({
      triggerId: job.triggerId,
      sourceInstanceId: job.sourceInstanceId,
      scopeRow: job.scopeRow,
      addressed: job.addressed,
      actorId: job.actorId,
      sourceType: job.sourceType,
      scopeKey: job.scopeKey ?? null,
      now: job.at ? new Date(job.at) : undefined,
    });
  }
}
