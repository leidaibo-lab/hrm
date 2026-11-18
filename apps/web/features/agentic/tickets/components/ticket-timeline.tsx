'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTicketTimeline } from '../api/tickets';

const TYPE_LABEL: Record<string, string> = {
  trigger: '事件',
  decision: '结论',
  artifact: '产物',
  assignment: '派发',
  attention: '关注',
  report: '回报',
};

/** 读取过滤事件原因；非过滤事件返回 null。 */
function toFilterReason(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object') return null;
  const value = (detail as { filterReason?: unknown }).filterReason;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** 工单轨迹：按时间展示事件、结论、产物与执行。 */
export function TicketTimeline({ id }: { id: string }) {
  const [at, setAt] = useState('');
  const timeline = useTicketTimeline(
    id,
    at ? new Date(at).toISOString() : undefined,
  );

  if (timeline.isPending) return <Skeleton className="h-32 w-full" />;
  if (timeline.isError)
    return (
      <p className="text-sm text-destructive">
        轨迹加载失败：{timeline.error.message}
      </p>
    );
  if (timeline.data.events.length === 0)
    return <p className="text-sm text-muted-foreground">暂无轨迹事件</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label="回放时间"
          className="max-w-[220px]"
          type="datetime-local"
          value={at}
          onChange={(event) => setAt(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">留空查看当前状态</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">状态：{timeline.data.snapshot.status}</Badge>
        <span>产物 {timeline.data.snapshot.artifacts.length} 个</span>
        <span>关注 {timeline.data.snapshot.attentions.length} 条</span>
        {timeline.data.snapshot.endReason && (
          <span>结束原因：{timeline.data.snapshot.endReason}</span>
        )}
      </div>
      <ol className="space-y-3">
        {timeline.data.events.map((event) => (
          <li key={event.id} className="border-l-2 pl-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(event.at).toLocaleString('zh-CN')}</span>
              <Badge variant="outline">
                {TYPE_LABEL[event.type] ?? event.type}
              </Badge>
            </div>
            <p className="mt-1 text-sm">{event.summary}</p>
            {toFilterReason(event.detail) && (
              <p className="mt-1 text-xs text-muted-foreground">
                过滤原因：{toFilterReason(event.detail)}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
