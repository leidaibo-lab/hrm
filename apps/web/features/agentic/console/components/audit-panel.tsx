'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditRecords } from '../api/audit';

/** 审计记录：动作、路径、状态与操作者。 */
export function AuditPanel() {
  const [action, setAction] = useState('');
  const [traceId, setTraceId] = useState('');
  const [filter, setFilter] = useState<{
    action?: string;
    traceId?: string;
  }>({});
  const [offset, setOffset] = useState(0);
  const records = useAuditRecords({ ...filter, offset });

  if (records.isPending)
    return (
      <div className="space-y-2 px-7">
        {['s1', 's2', 's3'].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );

  if (records.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        审计记录加载失败：{records.error.message}
      </p>
    );

  if (records.data.length === 0)
    return <p className="px-7 text-sm text-muted-foreground">暂无审计记录。</p>;

  return (
    <div className="space-y-3">
      <form
        className="flex items-center gap-2 px-7"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({
            ...(action.trim() ? { action: action.trim() } : {}),
            ...(traceId.trim() ? { traceId: traceId.trim() } : {}),
          });
          setOffset(0);
        }}
      >
        <Input
          aria-label="按动作筛选"
          className="max-w-[240px]"
          placeholder="按动作筛选，如 ticket.end"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        />
        <Input
          aria-label="按 traceId 筛选"
          className="max-w-[260px]"
          placeholder="按 traceId 筛选"
          value={traceId}
          onChange={(event) => setTraceId(event.target.value)}
        />
        <Button type="submit" size="sm" variant="outline">
          筛选
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setAction('');
            setTraceId('');
            setFilter({});
            setOffset(0);
          }}
        >
          清除
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>动作</TableHead>
            <TableHead>路径</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>操作者</TableHead>
            <TableHead>耗时</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>步骤</TableHead>
            <TableHead>时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.data.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-mono text-xs">
                {record.action}
              </TableCell>
              <TableCell className="text-xs">
                {record.method} {record.path}
              </TableCell>
              <TableCell>
                <Badge
                  variant={record.statusCode < 400 ? 'default' : 'destructive'}
                >
                  {record.statusCode}
                </Badge>
              </TableCell>
              <TableCell>{record.actorId ?? '—'}</TableCell>
              <TableCell>{formatDuration(record.detail)}</TableCell>
              <TableCell>{formatTokens(record.detail)}</TableCell>
              <TableCell>{formatSteps(record.detail)}</TableCell>
              <TableCell>
                {new Date(record.createdAt).toLocaleString('zh-CN')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end gap-2 px-7">
        <Button
          size="sm"
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(offset - 100, 0))}
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={records.data.length < 100}
          onClick={() => setOffset(offset + 100)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

/** 从审计 detail 读取运行耗时。 */
function formatDuration(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return '—';
  const duration = (detail as { durationMs?: unknown }).durationMs;
  return typeof duration === 'number' ? `${duration} ms` : '—';
}

/** 从审计 detail 读取 token 用量。 */
function formatTokens(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return '—';
  const tokens = (detail as { tokens?: unknown }).tokens;
  return typeof tokens === 'number' ? String(tokens) : '—';
}

/** 从审计 detail 读取工具步骤。 */
function formatSteps(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return '—';
  const steps = (detail as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length === 0) return '—';
  return steps
    .filter((step): step is string => typeof step === 'string')
    .join(' → ');
}
