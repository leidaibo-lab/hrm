import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ArtifactRepository } from '../../../domain/artifact.repository';
import type { TicketRepository } from '../../../domain/ticket.repository';

/** 读取工单工具的依赖。 */
export interface ReadTicketToolDeps {
  /** 工单仓储。 */
  tickets: TicketRepository;
  /** 产物仓储。 */
  artifacts: ArtifactRepository;
  /** 允许读取的 scopeKey；设置后跨范围工单一律不可见。 */
  scopeKey?: string | null;
  /** 工具级有效权限校验；缺省不校验（仅测试/系统内部）。 */
  authorize?: (tool: string) => Promise<boolean>;
}

/** 读取结果 schema。 */
const readTicketOutputSchema = z.object({
  /** 工单是否存在。 */
  found: z.boolean(),
  /** 工单状态。 */
  status: z.enum(['open', 'ended']).nullable(),
  /** 工单类型。 */
  kind: z.string().nullable(),
  /** 项目或空间标识。 */
  scopeKey: z.string().nullable(),
  /** 最新产物摘要。 */
  latestArtifact: z
    .object({
      /** 产物类型。 */
      kind: z.string(),
      /** 版本号。 */
      version: z.number().int(),
      /** 摘要文本；负载无 summary 时为 null。 */
      summary: z.string().nullable(),
    })
    .nullable(),
});

/**
 * 读取工单工具：只读工单状态与最新产物摘要，供角色在推理时按需调用。
 * 工具幂等、无外部副作用，可安全重放。
 */
export function createReadTicketTool(deps: ReadTicketToolDeps) {
  return createTool({
    id: 'read-ticket',
    description: '按工单主键读取工单状态、类型与最新产物摘要。',
    inputSchema: z.object({
      /** 工单主键。 */
      ticketId: z.string().min(1),
    }),
    outputSchema: readTicketOutputSchema,
    execute: async ({ ticketId }) => {
      if (deps.authorize && !(await deps.authorize('read-ticket')))
        throw new Error('工具权限不足：read-ticket');
      const ticket = await deps.tickets.findById(ticketId);
      if (!ticket || isOutOfScope(ticket.scopeKey, deps.scopeKey)) {
        return {
          found: false,
          status: null,
          kind: null,
          scopeKey: null,
          latestArtifact: null,
        };
      }
      const artifacts = await deps.artifacts.listByTicket(ticketId);
      const latest = artifacts.sort(
        (left, right) => right.version - left.version,
      )[0];
      const payload =
        latest?.payload && typeof latest.payload === 'object'
          ? (latest.payload as { summary?: unknown })
          : null;
      return {
        found: true,
        status: ticket.status,
        kind: ticket.kind,
        scopeKey: ticket.scopeKey,
        latestArtifact: latest
          ? {
              kind: latest.kind,
              version: latest.version,
              summary:
                typeof payload?.summary === 'string' ? payload.summary : null,
            }
          : null,
      };
    },
  });
}

/** 判断目标 scope 是否越出调用方允许范围。 */
function isOutOfScope(
  ticketScope: string | null,
  allowedScope: string | null | undefined,
): boolean {
  if (!allowedScope) return false;
  return ticketScope !== null && ticketScope !== allowedScope;
}
