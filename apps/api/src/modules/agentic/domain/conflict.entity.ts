import type { Trigger } from './trigger.entity';

/** 冲突类型：取消、范围变更、优先级变更、时限变更。 */
export type ConflictKind =
  | 'cancellation_request'
  | 'scope_change'
  | 'priority_change'
  | 'deadline_change';

/** 冲突标记：不替模型选择，只提示需要人/模型处理。 */
export interface Conflict {
  /** 冲突类型。 */
  kind: ConflictKind;
  /** 触发事件主键。 */
  triggerId: string;
  /** 关联的进行中工单主键。 */
  ticketId: string;
  /** 证据文本摘要。 */
  excerpt: string;
}

/** 冲突语义规则：只做提示，不替模型/人做选择。 */
const CONFLICT_RULES: ReadonlyArray<{
  kind: ConflictKind;
  pattern: RegExp;
}> = [
  {
    kind: 'cancellation_request',
    pattern: /(取消|撤销|作废|不做了|暂停|终止|不用做了|撤回需求)/i,
  },
  {
    kind: 'scope_change',
    pattern: /(范围|需求).{0,12}(改|变|扩|缩|调)|改需求|换需求|加需求/i,
  },
  {
    kind: 'priority_change',
    pattern: /(优先级|紧急|不急|P[0-3]|先行|插队)/i,
  },
  {
    kind: 'deadline_change',
    pattern: /(截止|上线|排期|deadline).{0,12}(提前|延后|推迟|调整|改)/i,
  },
];

/**
 * 识别「进行中工单的取消请求」冲突：只标记，不自动结束工单。
 * 输入为线程最近事件与线程工单，返回最多 3 条冲突证据。
 */
export function detectConflicts(
  triggers: readonly Trigger[],
  tickets: readonly { id: string; isOpen: boolean }[],
): Conflict[] {
  const open = tickets.filter((ticket) => ticket.isOpen);
  if (open.length === 0) return [];
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();
  for (const trigger of [...triggers].reverse()) {
    const matched = CONFLICT_RULES.filter((rule) =>
      rule.pattern.test(trigger.text),
    );
    if (matched.length === 0) continue;
    for (const rule of matched) {
      for (const ticket of open) {
        const key = `${rule.kind}:${trigger.id}:${ticket.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        conflicts.push({
          kind: rule.kind,
          triggerId: trigger.id,
          ticketId: ticket.id,
          excerpt: trigger.text.slice(0, 120),
        });
        if (conflicts.length >= 3) return conflicts;
      }
    }
  }
  return conflicts.slice(0, 3);
}
