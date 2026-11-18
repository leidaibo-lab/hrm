'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useThread } from '../api/threads';

const DISPOSITION_LABEL: Record<string, string> = {
  pending: '待处理',
  filtered: '已过滤',
  evaluated: '已研判',
  fanned_out: '已扇出',
};

/** 线程详情：摘要、事件时间线与工单。 */
export function ThreadDetailPanel({ key }: { key: string }) {
  const detail = useThread(key);

  if (detail.isPending)
    return (
      <div className="space-y-3 px-7">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (detail.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        线程详情加载失败：{detail.error.message}
      </p>
    );

  return (
    <div className="space-y-4 px-7 pb-7">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">摘要</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {detail.data.thread.summary ?? '暂无摘要'}
          <div className="mt-1 font-mono text-xs">
            v{detail.data.thread.summaryVersion} ·{' '}
            {detail.data.thread.sourceType} · {detail.data.thread.status}
          </div>
        </CardContent>
      </Card>

      {detail.data.conflicts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base">待确认冲突</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.data.conflicts.map((conflict) => (
              <p key={`${conflict.triggerId}-${conflict.ticketId}`}>
                工单 {conflict.ticketId} 可能收到取消/作废请求：
                <span className="text-muted-foreground">
                  {' '}
                  {conflict.excerpt}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">事件时间线</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.data.triggers.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无事件</p>
          )}
          {detail.data.triggers.map((trigger) => (
            <div key={trigger.id} className="border-l-2 pl-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {new Date(trigger.occurredAt).toLocaleString('zh-CN')}
                </span>
                <Badge variant="outline">{trigger.sourceType}</Badge>
                <Badge variant="outline">
                  {DISPOSITION_LABEL[trigger.disposition] ??
                    trigger.disposition}
                </Badge>
                <span>{trigger.actorId}</span>
              </div>
              <p className="mt-1 text-sm">{trigger.text}</p>
              {trigger.filterReason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  过滤原因：{trigger.filterReason}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">工单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.data.tickets.length === 0 && (
            <p className="text-muted-foreground">该线程还没有工单</p>
          )}
          {detail.data.tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center gap-2">
              <Badge variant="outline">{ticket.status}</Badge>
              <Link
                className="underline underline-offset-4"
                href={`/tickets/${ticket.id}`}
              >
                {ticket.id}
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
