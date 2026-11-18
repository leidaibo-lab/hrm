import type { AuditRecord } from '../domain/audit-record.entity';

/** 审计视图。 */
export interface AuditView {
  /** 主键。 */
  id: string;
  /** 追踪标识。 */
  traceId: string;
  /** 操作者。 */
  actorId?: string;
  /** 动作。 */
  action: string;
  /** 方法。 */
  method: string;
  /** 路径。 */
  path: string;
  /** 状态码。 */
  statusCode: number;
  /** 详情。 */
  detail: unknown;
  /** 时间。 */
  createdAt: string;
}

/** 记录 → 视图。 */
export function toAuditView(record: AuditRecord): AuditView {
  const { actorId, ...rest } = record;
  return {
    ...rest,
    ...(actorId ? { actorId } : {}),
    createdAt: record.createdAt.toISOString(),
  };
}

/** 回放中的单次运行。 */
export interface TraceRunView {
  /** 审计主键。 */
  id: string;
  /** 工单主键。 */
  ticketId?: string;
  /** 动作：agentic.run 或 internal.run.start。 */
  action: string;
  /** 调用方式或角色路径。 */
  path: string;
  /** 结果状态码。 */
  statusCode: number;
  /** 操作者；worker 为 null。 */
  actorId?: string;
  /** 时间。 */
  createdAt: string;
  /** 执行角色。 */
  role?: string;
  /** 是否投机运行。 */
  speculative?: boolean;
  /** 运行结果。 */
  result?: string;
  /** 失败原因。 */
  error?: string;
  /** 耗时毫秒。 */
  durationMs?: number;
  /** token 用量。 */
  tokens?: number;
  /** 工具步骤名（不含参数）。 */
  steps?: string[];
  /** 工具调用参数与结果（已脱敏）。 */
  toolCalls?: TraceToolCallView[];
  /** 授权主键。 */
  mandateId?: string;
  /** 策略版本。 */
  policyVersion?: number;
  /** 依据事件。 */
  triggerIds?: string[];
  /** 产物主键。 */
  artifactId?: string;
  /** 产物类型。 */
  artifactKind?: string;
  /** 产物版本。 */
  artifactVersion?: number;
}

/** 回放中的工具调用。 */
export interface TraceToolCallView {
  /** 调用标识。 */
  id?: string;
  /** 工具标识。 */
  name: string;
  /** 入参。 */
  input?: unknown;
  /** 结果。 */
  output?: unknown;
}

/** 回放中的产物。 */
export interface TraceArtifactView {
  /** 产物主键。 */
  artifactId: string;
  /** 工单主键。 */
  ticketId?: string;
  /** 产物类型。 */
  kind?: string;
  /** 版本。 */
  version?: number;
}

/** 回放中的授权与依据。 */
export interface TraceBasisView {
  /** 授权主键。 */
  mandateId?: string;
  /** 策略版本。 */
  policyVersion?: number;
  /** 依据事件。 */
  triggerIds?: string[];
}

/** 按 traceId 聚合的回放视图。 */
export interface TraceReplayView {
  /** 追踪标识。 */
  traceId: string;
  /** 运行记录。 */
  runs: TraceRunView[];
  /** 去重后的工具步骤。 */
  steps: string[];
  /** 产物记录。 */
  artifacts: TraceArtifactView[];
  /** 授权与依据。 */
  basis: TraceBasisView;
  /** 原始审计记录。 */
  items: AuditView[];
}

const RUN_ACTIONS = new Set(['agentic.run', 'internal.run.start']);

/** 详情转对象；非对象返回 null。 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** 读取字符串字段。 */
function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/** 读取数字字段。 */
function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

/** 读取字符串数组字段。 */
function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(
    (item): item is string => typeof item === 'string',
  );
  return items.length > 0 ? items : undefined;
}

/** 审计记录 → 运行视图。 */
function toTraceRun(record: AuditRecord): TraceRunView {
  const detail = asRecord(record.detail);
  const run: TraceRunView = {
    id: record.id,
    action: record.action,
    path: record.path,
    statusCode: record.statusCode,
    ...(record.actorId ? { actorId: record.actorId } : {}),
    ...(typeof detail?.ticketId === 'string'
      ? { ticketId: detail.ticketId }
      : {}),
    createdAt: record.createdAt.toISOString(),
  };
  if (!detail) return run;
  const role = readString(detail, 'role');
  const speculative = detail.speculative;
  const result = readString(detail, 'result');
  const error = readString(detail, 'error');
  const durationMs = readNumber(detail, 'durationMs');
  const tokens = readNumber(detail, 'tokens');
  const steps = readStringArray(detail, 'steps');
  const toolCalls = readToolCalls(detail);
  const mandateId = readString(detail, 'mandateId');
  const policyVersion = readNumber(detail, 'policyVersion');
  const triggerIds = readStringArray(detail, 'triggerIds');
  const artifactId = readString(detail, 'artifactId');
  const artifactKind = readString(detail, 'artifactKind');
  const artifactVersion = readNumber(detail, 'artifactVersion');
  if (role) run.role = role;
  if (typeof speculative === 'boolean') run.speculative = speculative;
  if (result) run.result = result;
  if (error) run.error = error;
  if (durationMs !== undefined) run.durationMs = durationMs;
  if (tokens !== undefined) run.tokens = tokens;
  if (steps) run.steps = steps;
  if (toolCalls) run.toolCalls = toolCalls;
  if (mandateId) run.mandateId = mandateId;
  if (policyVersion !== undefined) run.policyVersion = policyVersion;
  if (triggerIds) run.triggerIds = triggerIds;
  if (artifactId) run.artifactId = artifactId;
  if (artifactKind) run.artifactKind = artifactKind;
  if (artifactVersion !== undefined) run.artifactVersion = artifactVersion;
  return run;
}

/** 读取工具调用轨迹；形状不符的条目忽略。 */
function readToolCalls(
  detail: Record<string, unknown>,
): TraceToolCallView[] | undefined {
  const value = detail.toolCalls;
  if (!Array.isArray(value)) return undefined;
  const calls: TraceToolCallView[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as {
      name?: unknown;
      input?: unknown;
      output?: unknown;
    };
    if (typeof record.name !== 'string') continue;
    calls.push({
      name: record.name,
      ...(record.input !== undefined ? { input: record.input } : {}),
      ...(record.output !== undefined ? { output: record.output } : {}),
    });
  }
  return calls.length > 0 ? calls : undefined;
}

/** 产物视图；缺少主键时返回 null。 */
function toArtifact(input: {
  artifactId?: string;
  ticketId?: string;
  kind?: string;
  version?: number;
}): TraceArtifactView | null {
  if (!input.artifactId) return null;
  return {
    artifactId: input.artifactId,
    ...(input.ticketId ? { ticketId: input.ticketId } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  };
}

/** 按 traceId 聚合运行、步骤、产物与依据。 */
export function toTraceReplay(
  traceId: string,
  records: AuditRecord[],
): TraceReplayView {
  const runs = records
    .filter((record) => RUN_ACTIONS.has(record.action))
    .map(toTraceRun);
  const steps = [...new Set(runs.flatMap((run) => run.steps ?? []))];
  const artifacts = new Map<string, TraceArtifactView>();
  for (const record of records) {
    if (record.action !== 'internal.artifact.write') continue;
    const detail = asRecord(record.detail) ?? {};
    const artifact = toArtifact({
      artifactId: readString(detail, 'artifactId'),
      ticketId: readString(detail, 'ticketId'),
      kind: readString(detail, 'kind'),
      version: readNumber(detail, 'version'),
    });
    if (artifact) artifacts.set(artifact.artifactId, artifact);
  }
  for (const run of runs) {
    const artifact = toArtifact({
      artifactId: run.artifactId,
      kind: run.artifactKind,
      version: run.artifactVersion,
    });
    if (artifact) artifacts.set(artifact.artifactId, artifact);
  }
  const basis: TraceBasisView = {};
  for (const run of runs) {
    if (!basis.mandateId && run.mandateId) basis.mandateId = run.mandateId;
    if (basis.policyVersion === undefined && run.policyVersion !== undefined)
      basis.policyVersion = run.policyVersion;
    if (!basis.triggerIds && run.triggerIds) basis.triggerIds = run.triggerIds;
  }
  return {
    traceId,
    runs,
    steps,
    artifacts: [...artifacts.values()],
    basis,
    items: records.map(toAuditView),
  };
}
