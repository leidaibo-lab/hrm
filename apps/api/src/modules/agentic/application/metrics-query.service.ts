import { Injectable } from '@nestjs/common';
import { metrics } from '../domain/metrics.port';

/** 指标导出：把进程内注册表渲染为 Prometheus 文本。 */
@Injectable()
export class MetricsQueryService {
  /** 渲染当前指标。 */
  render(): string {
    return metrics.render();
  }

  /** 计数器 +1（供连接器等跨模块埋点）。 */
  increment(name: string, labels: Record<string, string> = {}): void {
    metrics.increment(name, labels);
  }

  /** 累计值增加。 */
  observe(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    metrics.observe(name, value, labels);
  }
}
