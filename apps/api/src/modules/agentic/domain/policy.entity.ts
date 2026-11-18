import type { MandateStrength } from './mandate.entity';

/** 策略快照：版本化的准入与研判规则。 */
export interface PolicySnapshot {
  /** 策略主键。 */
  id: string;
  /** 版本号，全局递增且唯一。 */
  version: number;
  /** 默认授权强度。 */
  acceptMode: MandateStrength;
  /** 规则体，结构由实现约束。 */
  rules: unknown;
  /** 创建人。 */
  createdBy: string;
  /** 创建时间。 */
  createdAt: Date;
}

/** 创建策略的输入。 */
export interface CreatePolicyInput {
  /** 策略主键。 */
  id: string;
  /** 版本号。 */
  version: number;
  /** 默认授权强度。 */
  acceptMode: MandateStrength;
  /** 规则体。 */
  rules: unknown;
  /** 创建人。 */
  createdBy: string;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 策略聚合：一次发布的规则快照。
 * 不可变；变更即新版本，旧版本继续服务于已开出的授权。
 */
export class Policy {
  readonly #id: string;
  readonly #version: number;
  readonly #acceptMode: MandateStrength;
  readonly #rules: unknown;
  readonly #createdBy: string;
  readonly #createdAt: Date;

  private constructor(snapshot: PolicySnapshot) {
    this.#id = snapshot.id;
    this.#version = snapshot.version;
    this.#acceptMode = snapshot.acceptMode;
    this.#rules = snapshot.rules;
    this.#createdBy = snapshot.createdBy;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建策略版本。 */
  static create(input: CreatePolicyInput): Policy {
    if (input.version < 1) throw new Error('策略版本必须为正整数');
    if (!input.createdBy.trim()) throw new Error('策略创建人不能为空');
    if (input.rules === null || input.rules === undefined)
      throw new Error('策略规则不能为空');
    return new Policy({
      id: input.id,
      version: input.version,
      acceptMode: input.acceptMode,
      rules: input.rules,
      createdBy: input.createdBy,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: PolicySnapshot): Policy {
    return new Policy(snapshot);
  }

  /** 策略主键。 */
  get id(): string {
    return this.#id;
  }

  /** 版本号。 */
  get version(): number {
    return this.#version;
  }

  /** 默认授权强度。 */
  get acceptMode(): MandateStrength {
    return this.#acceptMode;
  }

  /** 规则体。 */
  get rules(): unknown {
    return this.#rules;
  }

  /** 创建人。 */
  get createdBy(): string {
    return this.#createdBy;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 导出快照。 */
  toSnapshot(): PolicySnapshot {
    return {
      id: this.#id,
      version: this.#version,
      acceptMode: this.#acceptMode,
      rules: this.#rules,
      createdBy: this.#createdBy,
      createdAt: this.#createdAt,
    };
  }
}

/** 策略规则的可识别部分：名单与模型路由；其余键由各消费方解释。 */
export interface PolicyRules {
  /** 允许发起的源内成员标识。 */
  allowedActors?: string[];
  /** 允许发起的平台用户标识。 */
  allowedUsers?: string[];
  /** 研判模型路由，形如 cip/<slug>/<modelId>。 */
  assessmentModel?: string;
  /** fast 档模型路由；缺省回落 assessmentModel。 */
  fastModel?: string;
  /** main 档模型路由；缺省回落 assessmentModel。 */
  mainModel?: string;
  /** judge 档模型路由；缺省回落 main/clarification/assessment。 */
  judgeModel?: string;
  /** 澄清模型路由；缺省复用 assessmentModel。 */
  clarificationModel?: string;
  /** 允许写回的字段白名单；空表示不写字段。 */
  writebackFields?: string[];
  /** 回放时需要脱敏的字段名。 */
  auditRedactFields?: string[];
  /** 停滞升级的默认负责人（飞书 open_id）。 */
  escalationOwner?: string;
  /** 按来源类型覆盖的升级负责人；缺失时回落 escalationOwner。 */
  escalationOwnerBySource?: Record<string, string>;
  /** 是否启用投机执行：澄清稿无问题时后台先出拆解稿，确认后才交付。 */
  speculationEnabled?: boolean;
  /** 单次运行超时（毫秒）；缺省 120000。 */
  runTimeoutMs?: number;
  /** 单次运行 token 上限；缺省不限制。 */
  runTokenBudget?: number;
  /** 异步路由灰度：按来源/项目切换，缺省启用。 */
  routingRollout?: RoutingRolloutRules;
  /** 有效权限时间窗：按日重复；缺省不限。 */
  permissionWindow?: PermissionWindowRules;
  /** 是否启用 Router 慢路径模型判定；缺省关闭。 */
  routerAgentEnabled?: boolean;
  /** 是否启用 Watchdog 停滞扫描；缺省开启。 */
  watchdogEnabled?: boolean;
  /** 出站永久失败告警的飞书群 chat_id；缺省不发送外部告警。 */
  goneNotifyChatId?: string;
  /** Agent 回归通过阈值，0–1；缺省 0.8。 */
  regressionThreshold?: number;
}

/** 有效权限时间窗规则：本地时钟 + IANA 时区。 */
export interface PermissionWindowRules {
  /** 开始时刻 HH:mm。 */
  start: string;
  /** 结束时刻 HH:mm；小于开始表示跨夜。 */
  end: string;
  /** IANA 时区，如 Asia/Shanghai。 */
  timezone: string;
  /** 允许的星期（1=周一 … 7=周日）；缺省每天。 */
  days?: number[];
}

/** 有效权限时间窗边界。 */
export interface PermissionWindow {
  /** 生效起点；缺省不限制。 */
  from?: Date;
  /** 生效终点；缺省不限制。 */
  to?: Date;
}

/** 异步路由灰度规则。 */
export interface RoutingRolloutRules {
  /** 是否启用异步路由；缺省 true。 */
  enabled?: boolean;
  /** 仅这些来源类型启用；空/缺省表示不限。 */
  sources?: string[];
  /** 仅这些项目/空间启用；空/缺省表示不限。 */
  scopeKeys?: string[];
  /** 仅这些执行角色启用异步路径；空/缺省表示不限。 */
  roles?: string[];
  /** 仅这些工单启用异步路径；空/缺省表示不限。 */
  ticketIds?: string[];
}

/** 从任意规则负载中读取已知键；类型不符的键忽略。 */
export function readPolicyRules(rules: unknown): PolicyRules {
  if (!rules || typeof rules !== 'object') return {};
  const record = rules as Record<string, unknown>;
  const allowedActors = stringArray(record.allowedActors);
  const allowedUsers = stringArray(record.allowedUsers);
  const assessmentModel =
    typeof record.assessmentModel === 'string'
      ? record.assessmentModel
      : undefined;
  const fastModel =
    typeof record.fastModel === 'string' ? record.fastModel : undefined;
  const mainModel =
    typeof record.mainModel === 'string' ? record.mainModel : undefined;
  const judgeModel =
    typeof record.judgeModel === 'string' ? record.judgeModel : undefined;
  const clarificationModel =
    typeof record.clarificationModel === 'string'
      ? record.clarificationModel
      : undefined;
  const writebackFields = stringArray(record.writebackFields);
  const auditRedactFields = stringArray(record.auditRedactFields);
  const escalationOwner =
    typeof record.escalationOwner === 'string'
      ? record.escalationOwner
      : undefined;
  const speculationEnabled =
    typeof record.speculationEnabled === 'boolean'
      ? record.speculationEnabled
      : undefined;
  const escalationOwnerBySource = stringRecord(record.escalationOwnerBySource);
  const routingRollout = readRoutingRollout(record.routingRollout);
  const permissionWindow = readPermissionWindowRules(record.permissionWindow);
  const routerAgentEnabled =
    typeof record.routerAgentEnabled === 'boolean'
      ? record.routerAgentEnabled
      : undefined;
  const watchdogEnabled =
    typeof record.watchdogEnabled === 'boolean'
      ? record.watchdogEnabled
      : undefined;
  const goneNotifyChatId =
    typeof record.goneNotifyChatId === 'string' &&
    record.goneNotifyChatId.trim().length > 0
      ? record.goneNotifyChatId.trim()
      : undefined;
  const regressionThreshold =
    typeof record.regressionThreshold === 'number' &&
    Number.isFinite(record.regressionThreshold) &&
    record.regressionThreshold > 0 &&
    record.regressionThreshold <= 1
      ? record.regressionThreshold
      : undefined;
  const runTokenBudget =
    typeof record.runTokenBudget === 'number' &&
    Number.isInteger(record.runTokenBudget) &&
    record.runTokenBudget >= 1_000 &&
    record.runTokenBudget <= 2_000_000
      ? record.runTokenBudget
      : undefined;
  const runTimeoutMs =
    typeof record.runTimeoutMs === 'number' &&
    Number.isInteger(record.runTimeoutMs) &&
    record.runTimeoutMs >= 1_000 &&
    record.runTimeoutMs <= 600_000
      ? record.runTimeoutMs
      : undefined;
  return {
    allowedActors,
    allowedUsers,
    assessmentModel,
    fastModel,
    mainModel,
    judgeModel,
    clarificationModel,
    writebackFields,
    auditRedactFields,
    escalationOwner,
    escalationOwnerBySource,
    speculationEnabled,
    runTimeoutMs,
    runTokenBudget,
    routingRollout,
    permissionWindow,
    routerAgentEnabled,
    watchdogEnabled,
    goneNotifyChatId,
    regressionThreshold,
  };
}

/** 读取异步路由灰度规则；类型不符的字段忽略。 */
function readRoutingRollout(value: unknown): RoutingRolloutRules | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : undefined,
    sources: stringArray(record.sources),
    scopeKeys: stringArray(record.scopeKeys),
    roles: stringArray(record.roles),
    ticketIds: stringArray(record.ticketIds),
  };
}

/** 读取时间窗规则；缺省或结构不符返回 undefined。 */
function readPermissionWindowRules(
  value: unknown,
): PermissionWindowRules | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.start !== 'string' || typeof record.end !== 'string')
    return undefined;
  if (typeof record.timezone !== 'string') return undefined;
  const days = Array.isArray(record.days)
    ? record.days.filter(
        (day): day is number =>
          typeof day === 'number' &&
          Number.isInteger(day) &&
          day >= 1 &&
          day <= 7,
      )
    : undefined;
  return {
    start: record.start,
    end: record.end,
    timezone: record.timezone,
    days: days && days.length > 0 ? days : undefined,
  };
}

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** 解析 HH:mm；非法返回 null。 */
function parseClock(value: string): number | null {
  const match = CLOCK_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 读取指定时区的本地时间片。 */
function localParts(
  now: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  minute: number;
  weekday: number;
} | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(now)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    const weekday = WEEKDAYS.indexOf(
      parts.weekday as (typeof WEEKDAYS)[number],
    );
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      minute: Number(parts.hour) * 60 + Number(parts.minute),
      weekday: weekday >= 0 ? ((weekday + 6) % 7) + 1 : 1,
    };
  } catch {
    return null;
  }
}

/** 把本地日期与分钟换算为 UTC 时刻；offset 由当前时刻推算。 */
function instantFor(
  year: number,
  month: number,
  day: number,
  minute: number,
  offsetMs: number,
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60) -
      offsetMs,
  );
}

/**
 * 读取时间窗边界：缺省返回 undefined；配置存在但非法时返回一个「尚未开始」的窗口，
 * 由有效权限判定拒绝（fail closed）。
 */
export function readPermissionWindow(
  rules: unknown,
  now: Date,
): PermissionWindow | undefined {
  if (!rules || typeof rules !== 'object') return undefined;
  const raw = (rules as Record<string, unknown>).permissionWindow;
  if (raw === undefined) return undefined;
  const parsed = readPermissionWindowRules(raw);
  const start = parsed ? parseClock(parsed.start) : null;
  const end = parsed ? parseClock(parsed.end) : null;
  if (!parsed || start === null || end === null)
    return { from: new Date(now.getTime() + 60_000) };

  const local = localParts(now, parsed.timezone);
  if (!local) return { from: new Date(now.getTime() + 60_000) };
  if (parsed.days && !parsed.days.includes(local.weekday))
    return { from: new Date(now.getTime() + 24 * 60 * 60 * 1000) };

  const offsetMs =
    Date.UTC(local.year, local.month - 1, local.day) +
    local.minute * 60_000 -
    now.getTime();
  const startAt = instantFor(
    local.year,
    local.month,
    local.day,
    start,
    offsetMs,
  );
  if (end > start) {
    return {
      from: startAt,
      to: instantFor(local.year, local.month, local.day, end, offsetMs),
    };
  }
  if (local.minute >= start) {
    return {
      from: startAt,
      to: instantFor(local.year, local.month, local.day + 1, end, offsetMs),
    };
  }
  if (local.minute < end) {
    return {
      from: instantFor(local.year, local.month, local.day - 1, start, offsetMs),
      to: instantFor(local.year, local.month, local.day, end, offsetMs),
    };
  }
  return {
    from: startAt,
    to: instantFor(local.year, local.month, local.day, end, offsetMs),
  };
}

/** 解析升级负责人：优先来源类型专属配置，其次默认负责人。 */
export function readEscalationOwner(
  rules: unknown,
  sourceType?: string,
): string | undefined {
  const parsed = readPolicyRules(rules);
  if (sourceType) {
    const specific = parsed.escalationOwnerBySource?.[sourceType]?.trim();
    if (specific) return specific;
  }
  return parsed.escalationOwner?.trim() || undefined;
}

/** 判断源内成员是否在名单；平台用户标识同样参与匹配。 */
export function isActorListed(rules: unknown, actorId: string): boolean {
  const parsed = readPolicyRules(rules);
  return (
    (parsed.allowedActors?.includes(actorId) ?? false) ||
    (parsed.allowedUsers?.includes(actorId) ?? false)
  );
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}
