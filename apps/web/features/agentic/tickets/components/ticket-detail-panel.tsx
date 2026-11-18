'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useEndTicket,
  useReopenTicket,
  useRestoreArtifact,
  useRevokeWriteback,
  useTicket,
} from '../api/tickets';
import { TicketTimeline } from './ticket-timeline';

/** 工单详情：授权、产物、关注与派发，并提供结束/重开。 */
export function TicketDetailPanel({
  id,
  canReadAudit = true,
}: {
  id: string;
  canReadAudit?: boolean;
}) {
  const ticket = useTicket(id);
  const endTicket = useEndTicket(id);
  const reopenTicket = useReopenTicket(id);
  const restore = useRestoreArtifact(id);
  const revoke = useRevokeWriteback(id);
  const [reason, setReason] = useState('');

  if (ticket.isPending)
    return (
      <div className="space-y-3 px-7">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (ticket.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        工单详情加载失败：{ticket.error.message}
      </p>
    );

  const detail = ticket.data;

  return (
    <div className="space-y-4 px-7 pb-7">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant={detail.ticket.status === 'open' ? 'default' : 'secondary'}
        >
          {detail.ticket.status === 'open' ? '进行中' : '已结束'}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {detail.ticket.kind} · {detail.ticket.scopeKey ?? '无项目'} · 开启于{' '}
          {new Date(detail.ticket.openedAt).toLocaleString('zh-CN')}
        </span>
      </div>

      {detail.ticket.status === 'open' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-sm"
            placeholder="结束原因"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            disabled={endTicket.isPending || reason.trim().length === 0}
            onClick={() => endTicket.mutate(reason.trim())}
          >
            结束工单
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            结束原因：{detail.ticket.endReason ?? '—'}
          </span>
          <Button
            variant="outline"
            disabled={reopenTicket.isPending}
            onClick={() => reopenTicket.mutate()}
          >
            重新打开
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">轨迹</CardTitle>
        </CardHeader>
        <CardContent>
          {canReadAudit ? (
            <TicketTimeline id={id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              轨迹需要 audit:read 权限，当前不可见。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">授权</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {detail.mandate
            ? `${detail.mandate.strength} · 策略 v${detail.mandate.policyVersion}`
            : '无授权记录'}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">产物</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.artifacts.length === 0 && (
            <p className="text-muted-foreground">暂无产物</p>
          )}
          {detail.artifacts.map((artifact) => (
            <div key={artifact.id} className="flex items-center gap-2">
              <Badge variant="outline">{artifact.kind}</Badge>
              <span>v{artifact.version}</span>
              <span className="text-muted-foreground">{artifact.status}</span>
              {artifact.version > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    restore.isPending || detail.ticket.status !== 'open'
                  }
                  onClick={() => restore.mutate(artifact.kind)}
                >
                  回滚
                </Button>
              )}
              {artifact.status === 'confirmed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.isPending || detail.ticket.status !== 'open'}
                  onClick={() => revoke.mutate(artifact.kind)}
                >
                  撤销回填
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">待答关注</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.attentions.length === 0 && (
            <p className="text-muted-foreground">没有待答问题</p>
          )}
          {detail.attentions.map((attention) => (
            <p key={attention.id}>
              {attention.question}（等待 {attention.assignee}）
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">派发</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.assignments.length === 0 && (
            <p className="text-muted-foreground">尚未派发执行器</p>
          )}
          {detail.assignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center gap-2">
              <Badge variant="outline">{assignment.status}</Badge>
              <span>第 {assignment.attempt} 次</span>
              {assignment.error && (
                <span className="text-destructive">{assignment.error}</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
