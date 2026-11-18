'use client';

import Link from 'next/link';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditRecords } from '../api/audit';
import type { TraceRunView } from '../api/types';

/** 读取运行详情；非对象时为 null。 */
function toRunDetail(detail: unknown): TraceRunView | null {
  if (!detail || typeof detail !== 'object') return null;
  const value = detail as TraceRunView;
  return typeof value.role === 'string' ? value : null;
}

/** 运行轨迹：按 traceId 展示运行级审计、步骤与授权依据。 */
export function RunTracePanel() {
  const records = useAuditRecords({ action: 'agentic.run' });

  if (records.isPending)
    return (
      <div className="space-y-3 px-7">
        {['s1', 's2', 's3'].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
    );

  if (records.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        运行轨迹加载失败：{records.error.message}
      </p>
    );

  if (records.data.length === 0)
    return (
      <p className="px-7 text-sm text-muted-foreground">
        暂无运行记录。澄清/拆解任务执行后，这里会展示运行级审计。
      </p>
    );

  return (
    <div className="space-y-3 px-7">
      {records.data.map((record) => {
        const run = toRunDetail(record.detail);
        return (
          <div key={record.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
              <span className="font-mono">{record.traceId}</span>
              <Badge variant="outline">{run?.role ?? record.path}</Badge>
              {run?.speculative && <Badge variant="secondary">投机</Badge>}
              <Badge
                variant={record.statusCode >= 500 ? 'destructive' : 'secondary'}
              >
                {run?.result ?? `HTTP ${record.statusCode}`}
              </Badge>
              {run?.durationMs !== undefined && (
                <span>{formatDuration(run.durationMs)}</span>
              )}
              {run?.tokens !== undefined && <span>{run.tokens} tokens</span>}
            </div>
            <div className="mt-2 text-sm">
              工单{' '}
              {run?.ticketId ? (
                <Link
                  className="underline underline-offset-4"
                  href={`/tickets/${run.ticketId}`}
                >
                  {run.ticketId}
                </Link>
              ) : (
                '—'
              )}
              {run?.mandateId && (
                <span className="ml-3 text-xs text-muted-foreground">
                  授权 <span className="font-mono">{run.mandateId}</span>
                  {run.policyVersion !== undefined
                    ? ` · 策略 v${run.policyVersion}`
                    : ''}
                </span>
              )}
            </div>
            {run?.steps && run.steps.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted-foreground">步骤</span>
                {run.steps.map((step) => (
                  <Badge key={step} variant="outline">
                    {step}
                  </Badge>
                ))}
              </div>
            )}
            {run?.toolCalls && run.toolCalls.length > 0 && (
              <div className="mt-3 space-y-2">
                {run.toolCalls.map((call) => (
                  <Tool key={call.id ?? call.name}>
                    <ToolHeader
                      type={`tool-${call.name}`}
                      state="output-available"
                      title={call.name}
                    />
                    <ToolContent>
                      {call.input !== undefined && (
                        <ToolInput input={call.input} />
                      )}
                      {call.output !== undefined && (
                        <ToolOutput
                          output={call.output}
                          errorText={undefined}
                        />
                      )}
                    </ToolContent>
                  </Tool>
                ))}
              </div>
            )}
            {run?.artifactId && (
              <p className="mt-1 text-xs text-muted-foreground">
                产物 <span className="font-mono">{run.artifactId}</span>
                {`${run.artifactKind ? ` · ${run.artifactKind}` : ''}${
                  run.artifactVersion !== undefined
                    ? ` v${run.artifactVersion}`
                    : ''
                }`}
              </p>
            )}
            {run?.error && (
              <p className="mt-1 text-xs text-destructive">错误：{run.error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 毫秒转可读时长。 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}
