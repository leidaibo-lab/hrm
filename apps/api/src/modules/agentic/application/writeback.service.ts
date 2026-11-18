import { Inject, Injectable } from '@nestjs/common';
import type { Artifact } from '../domain/artifact.entity';
import { readPolicyRules } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';
import { ThreadNotifierService } from './thread-notifier.service';

/** 写回结果：实际写出的字段。 */
export interface WritebackResult {
  /** 已写字段。 */
  fields: Record<string, unknown>;
}

/**
 * 产物写回：只写策略声明的字段，不碰优先级与排期。
 * 当前以文本形式回写来源线程，字段值来自产物草稿。
 */
@Injectable()
export class WritebackService {
  constructor(
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    private readonly notifier: ThreadNotifierService,
  ) {}

  /** 确认后写回声明的字段；无白名单时返回空结果。 */
  async writeback(
    threadId: string,
    ticketId: string,
    artifact: Artifact,
  ): Promise<WritebackResult> {
    const policy = await this.policies.findCurrent();
    const allowed = readPolicyRules(policy?.rules).writebackFields ?? [];
    if (allowed.length === 0) return { fields: {} };

    const payload = artifact.payload as { draft?: unknown };
    const draft =
      payload.draft && typeof payload.draft === 'object'
        ? (payload.draft as Record<string, unknown>)
        : {};
    const fields: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in draft) fields[key] = draft[key];
    }
    if (Object.keys(fields).length === 0) return { fields: {} };

    const written = await this.notifier.notifyFields(
      threadId,
      fields,
      `writeback:${ticketId}:${artifact.id}`,
    );
    if (!written) {
      const lines = Object.entries(fields).map(
        ([key, value]) => `${key}：${String(value)}`,
      );
      await this.notifier.notify(
        threadId,
        `已确认字段：\n${lines.join('\n')}`,
        `writeback:${ticketId}:${artifact.id}`,
      );
    }
    return { fields };
  }
}
