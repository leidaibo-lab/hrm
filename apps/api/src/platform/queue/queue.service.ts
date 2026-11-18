import { createHash } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Job, type JobsOptions, Queue, Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { env } from '../../config/env';

/** BullMQ 6 自定义 jobId 不允许冒号；替换后追加短哈希避免不同键碰撞。 */
export function sanitizeJobId(jobId?: string): string | undefined {
  if (jobId === undefined || !jobId.includes(':')) return jobId;
  const readable = jobId.replaceAll(':', '-').slice(0, 80);
  const digest = createHash('sha1').update(jobId).digest('hex').slice(0, 8);
  return `${readable}-${digest}`;
}

/**
 * 队列适配器（ADR-0015）：BullMQ 全局封装，进程内共享一条 ioredis 连接。
 * 生产者经 enqueue 投递，消费者经 createWorker 注册处理器；
 * 连接生命周期由本服务统一管理，业务模块不触碰连接。
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: Redis = new IORedis(env.REDIS_URL, {
    // BullMQ 要求：处理器内部自行控制重试，连接层不限制未完成命令数
    maxRetriesPerRequest: null,
    // 连接策略声明（runtime 缓存与配置 3）：队列消费为常驻重连（ioredis 默认指数退避），
    // Redis 恢复后自动续接任务；与 RedisService 的 fail-fast（retryStrategy: () => null，
    // 支撑限流 fail-open 判定）是有意取舍，不可互相套用。
  });
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  /**
   * 投递一个任务。
   * @returns 任务 ID（BullMQ 生成，入队失败抛出）。
   */
  async enqueue<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<string> {
    // BullMQ 6 拒绝自定义 jobId 中的冒号；统一替换，保留可读性与去重语义。
    const jobId = sanitizeJobId(options?.jobId);
    const job = await this.queue(queueName).add(
      jobName,
      data,
      jobId === undefined ? options : { ...options, jobId },
    );
    return String(job.id);
  }

  /**
   * 注册一个消费者。同一队列重复注册会抛出（消费端点应当唯一）。
   * @param processor - 任务处理器；抛出即按 BullMQ 重试策略重试。
   */
  createWorker<T>(
    queueName: string,
    processor: (job: Job<T>) => Promise<void>,
    concurrency = 1,
  ): Worker {
    if (this.workers.some((worker) => worker.name === queueName)) {
      throw new Error(`队列 ${queueName} 的消费者已注册`);
    }
    const worker = new Worker<T>(queueName, processor, {
      connection: this.connection,
      concurrency,
    });
    worker.on('failed', (job, cause) => {
      this.logger.warn(
        `队列 ${queueName} 任务 ${job?.id ?? '?'} 失败: ${cause.message}`,
      );
    });
    worker.on('error', (cause) => {
      this.logger.error(`队列 ${queueName} 消费者异常: ${cause.message}`);
    });
    this.workers.push(worker);
    return worker;
  }

  private queue(queueName: string): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, { connection: this.connection });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.workers.map((worker) => worker.close()));
    await Promise.allSettled(
      [...this.queues.values()].map((queue) => queue.close()),
    );
    if (this.connection.status === 'ready') {
      await this.connection.quit().catch(() => undefined);
    }
  }
}
