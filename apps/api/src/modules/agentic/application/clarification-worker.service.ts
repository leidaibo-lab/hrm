import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Job } from 'bullmq';
import { QueueService } from '../../../platform/queue';
import type { Artifact } from '../domain/artifact.entity';
import type { ClarificationJob } from '../domain/clarification-queue.port';
import { CLARIFICATION_QUEUE_NAME } from '../domain/clarification-queue.port';
import { metrics } from '../domain/metrics.port';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import type { ToolCallTrace } from '../domain/tool-trace.entity';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';
import { AuditRecordService } from './audit-record.service';
import { ClarificationService } from './clarification.service';
import { RunFailureService } from './run-failure.service';

/** 澄清任务消费者：worker 进程内运行，接单后异步出稿。 */
@Injectable()
export class ClarificationWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ClarificationWorkerService.name);
  private worker: ReturnType<QueueService['createWorker']> | null = null;

  constructor(
    private readonly queue: QueueService,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(TRIGGER_REPOSITORY) private readonly triggers: TriggerRepository,
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    private readonly clarification: ClarificationService,
    private readonly audit: AuditRecordService,
    private readonly runFailure: RunFailureService,
  ) {}

  /** 注册消费者。 */
  onModuleInit(): void {
    this.worker = this.queue.createWorker<ClarificationJob>(
      CLARIFICATION_QUEUE_NAME,
      (job) => this.handleJob(job),
      2,
    );
  }

  /** 关闭消费者。 */
  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  /** 处理队列任务：末次尝试仍失败时转人工关注后继续抛出。 */
  async handleJob(job: Job<ClarificationJob>): Promise<void> {
    try {
      await this.handle(job.data);
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= attempts) {
        await this.runFailure.report({
          ticketId: job.data.ticketId,
          role: 'clarify',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
      throw error;
    }
  }

  /** 处理一条澄清任务；工单关闭、策略缺失或事件缺失时跳过。 */
  async handle(job: ClarificationJob): Promise<void> {
    const ticket = await this.tickets.findById(job.ticketId);
    if (!ticket?.isOpen) return;
    const policy = await this.policies.findCurrent();
    if (!policy) return;
    const triggers = await this.triggers.listByIds(job.triggerIds);
    if (triggers.length === 0) return;
    const startedAt = Date.now();
    const traceId = randomUUID();
    try {
      const result = await this.clarification.start({
        ticketId: ticket.id,
        threadId: ticket.threadId,
        triggers,
        policy,
      });
      await this.recordRun({
        traceId,
        ticketId: ticket.id,
        scopeKey: ticket.scopeKey,
        mandateId: ticket.mandateId,
        policyVersion: policy.version,
        triggerIds: job.triggerIds,
        role: 'clarify',
        statusCode: 200,
        result: 'succeeded',
        error: null,
        durationMs: Date.now() - startedAt,
        tokens: result?.tokens,
        steps: result?.steps,
        toolCalls: result?.toolCalls,
        artifact: result?.artifact ?? null,
      });
      metrics.increment('agentic_runs_total', {
        role: 'clarify',
        result: 'succeeded',
      });
    } catch (error) {
      await this.recordRun({
        traceId,
        ticketId: ticket.id,
        scopeKey: ticket.scopeKey,
        mandateId: ticket.mandateId,
        policyVersion: policy.version,
        triggerIds: job.triggerIds,
        role: 'clarify',
        statusCode: 500,
        result: 'failed',
        error: error instanceof Error ? error.message : '未知错误',
        durationMs: Date.now() - startedAt,
      });
      metrics.increment('agentic_runs_total', {
        role: 'clarify',
        result: 'failed',
      });
      throw error;
    }
  }

  /** 运行级审计：写失败只告警，不影响主流程。 */
  private async recordRun(input: {
    traceId: string;
    ticketId: string;
    scopeKey: string | null;
    mandateId: string;
    policyVersion: number;
    triggerIds: string[];
    role: 'clarify';
    statusCode: number;
    result: 'succeeded' | 'failed';
    error: string | null;
    durationMs: number;
    tokens?: number;
    steps?: string[];
    toolCalls?: ToolCallTrace[];
    artifact?: Artifact | null;
  }): Promise<void> {
    try {
      await this.audit.record({
        traceId: input.traceId,
        actorId: null,
        action: 'agentic.run',
        method: 'WORKER',
        path: input.role,
        statusCode: input.statusCode,
        detail: {
          ticketId: input.ticketId,
          scopeKey: input.scopeKey,
          role: input.role,
          mandateId: input.mandateId,
          policyVersion: input.policyVersion,
          triggerIds: input.triggerIds,
          result: input.result,
          error: input.error,
          durationMs: input.durationMs,
          ...(input.artifact
            ? {
                artifactId: input.artifact.id,
                artifactKind: input.artifact.kind,
                artifactVersion: input.artifact.version,
              }
            : {}),
          ...(input.tokens !== undefined ? { tokens: input.tokens } : {}),
          ...(input.steps && input.steps.length > 0
            ? { steps: input.steps }
            : {}),
          ...(input.toolCalls && input.toolCalls.length > 0
            ? { toolCalls: input.toolCalls }
            : {}),
        },
      });
    } catch (auditError) {
      this.logger.warn(
        `澄清运行审计写入失败：${
          auditError instanceof Error ? auditError.message : '未知错误'
        }`,
      );
    }
  }
}
