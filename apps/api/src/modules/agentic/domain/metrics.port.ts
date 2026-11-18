/**
 * 指标注册表（V0 进程内）：计数器与累计值，供 `/internal/metrics` 导出。
 * 放在 domain 以避免 application 依赖 platform；接入集中式指标后端时替换实现。
 */
export type MetricLabels = Record<string, string>;

/** 指标导出行。 */
interface MetricLine {
  name: string;
  labels: MetricLabels;
  value: number;
}

/** 指标服务：increment/observe + Prometheus 渲染。 */
export class MetricsRegistry {
  private readonly counters = new Map<string, MetricLine>();
  private readonly totals = new Map<string, MetricLine>();

  /** 计数器 +1。 */
  increment(name: string, labels: MetricLabels = {}): void {
    const key = `${name}|${labelKey(labels)}`;
    const existing = this.counters.get(key);
    if (existing) existing.value += 1;
    else this.counters.set(key, { name, labels: { ...labels }, value: 1 });
  }

  /** 累计值增加（如 token 数、耗时毫秒）。 */
  observe(name: string, value: number, labels: MetricLabels = {}): void {
    if (!Number.isFinite(value) || value < 0) return;
    const key = `${name}|${labelKey(labels)}`;
    const existing = this.totals.get(key);
    if (existing) existing.value += value;
    else this.totals.set(key, { name, labels: { ...labels }, value });
  }

  /** 渲染 Prometheus 文本格式。 */
  render(): string {
    const lines: string[] = [];
    const byName = new Map<string, MetricLine[]>();
    for (const line of this.counters.values()) {
      const list = byName.get(line.name) ?? [];
      list.push(line);
      byName.set(line.name, list);
    }
    for (const [name, list] of [...byName.entries()].sort()) {
      lines.push(`# TYPE ${name} counter`);
      for (const line of list.sort((left, right) =>
        labelKey(left.labels).localeCompare(labelKey(right.labels)),
      )) {
        lines.push(`${name}${formatLabels(line.labels)} ${line.value}`);
      }
    }
    const totalsByName = new Map<string, MetricLine[]>();
    for (const line of this.totals.values()) {
      const list = totalsByName.get(line.name) ?? [];
      list.push(line);
      totalsByName.set(line.name, list);
    }
    for (const [name, list] of [...totalsByName.entries()].sort()) {
      lines.push(`# TYPE ${name} counter`);
      for (const line of list.sort((left, right) =>
        labelKey(left.labels).localeCompare(labelKey(right.labels)),
      )) {
        lines.push(`${name}${formatLabels(line.labels)} ${line.value}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  /** 清空（仅测试使用）。 */
  reset(): void {
    this.counters.clear();
    this.totals.clear();
  }
}

/** 全局指标单例：业务代码直接递增，避免扩散构造依赖。 */
export const metrics = new MetricsRegistry();

/** 标签稳定序列化。 */
function labelKey(labels: MetricLabels): string {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join(',');
}

/** 渲染 Prometheus 标签。 */
function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.length === 0) return '';
  return `{${entries
    .map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`)
    .join(',')}}`;
}
