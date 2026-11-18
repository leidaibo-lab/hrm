import { describe, expect, it } from 'vitest';
import { MetricsRegistry } from '../metrics.port';

describe('MetricsRegistry', () => {
  it('计数器与累计值按 Prometheus 文本导出', () => {
    const service = new MetricsRegistry();
    service.increment('agentic_events_total', { event: 'trigger_received' });
    service.increment('agentic_events_total', { event: 'trigger_received' });
    service.increment('agentic_runs_total', {
      role: 'clarify',
      result: 'succeeded',
    });
    service.observe('agentic_tokens_total', 1200);
    service.observe('agentic_run_duration_ms_total', 500, { role: 'clarify' });

    const text = service.render();
    expect(text).toContain('agentic_events_total{event="trigger_received"} 2');
    expect(text).toContain(
      'agentic_runs_total{result="succeeded",role="clarify"} 1',
    );
    expect(text).toContain('agentic_tokens_total 1200');
    expect(text).toContain('agentic_run_duration_ms_total{role="clarify"} 500');
    expect(text).toContain('# TYPE agentic_events_total counter');
  });

  it('忽略非法累计值', () => {
    const service = new MetricsRegistry();
    service.observe('agentic_tokens_total', Number.NaN);
    service.observe('agentic_tokens_total', -1);
    expect(service.render()).not.toContain('agentic_tokens_total');
  });
});
