'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import { useTickets } from '../api/tickets';

const KIND_LABEL: Record<string, string> = {
  requirement: '需求',
  bug: '缺陷',
  release: '发布',
};

/** 从当前 URL 读取筛选参数；无 window 时返回 null。 */
function readFilterParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

/** 截止时间单元格：逾期优先展示徽标。 */
function DeadlineCell({
  overdue,
  deadline,
}: {
  overdue: boolean;
  deadline?: string;
}) {
  if (overdue) return <Badge variant="destructive">已逾期</Badge>;
  if (!deadline) return <>—</>;
  return <>{new Date(deadline).toLocaleString('zh-CN')}</>;
}

/** 工单列表：状态、类型、负责人、超时标记与详情入口。 */
export function TicketsPanel() {
  const [status, setStatus] = useState<'all' | 'open' | 'ended'>(() => {
    const value = readFilterParam('status');
    return value === 'open' || value === 'ended' ? value : 'all';
  });
  const [sort, setSort] = useState<'opened' | 'overdue'>(() =>
    readFilterParam('sort') === 'overdue' ? 'overdue' : 'opened',
  );
  const [scope, setScope] = useState(() => readFilterParam('scope') ?? '');
  const [scopeFilter, setScopeFilter] = useState<string | undefined>(
    () => readFilterParam('scope') ?? undefined,
  );
  const tickets = useTickets({
    status: status === 'all' ? undefined : status,
    scopeKey: scopeFilter,
    limit: 50,
  });

  // 筛选进 URL：刷新/回退可恢复，不依赖客户端内存。
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (scopeFilter) params.set('scope', scopeFilter);
    if (sort !== 'opened') params.set('sort', sort);
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  }, [status, scopeFilter, sort]);

  const sorted = useMemo(() => {
    const items = [...(tickets.data ?? [])];
    if (sort === 'overdue')
      items.sort(
        (left, right) =>
          Number(right.overdue) - Number(left.overdue) ||
          (right.deadline ?? '').localeCompare(left.deadline ?? ''),
      );
    else
      items.sort(
        (left, right) =>
          new Date(right.openedAt).getTime() -
          new Date(left.openedAt).getTime(),
      );
    return items;
  }, [tickets.data, sort]);

  if (tickets.isPending)
    return (
      <div className="space-y-2 px-7">
        {['s1', 's2', 's3', 's4', 's5'].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );

  if (tickets.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        工单列表加载失败：{tickets.error.message}
      </p>
    );

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      {[
        { key: 'all', label: '全部' },
        { key: 'open', label: '进行中' },
        { key: 'ended', label: '已结束' },
      ].map((item) => (
        <Button
          key={item.key}
          size="sm"
          variant={status === item.key ? 'default' : 'outline'}
          onClick={() => setStatus(item.key as 'all' | 'open' | 'ended')}
        >
          {item.label}
        </Button>
      ))}
      <Input
        aria-label="按项目筛选"
        className="max-w-[220px]"
        placeholder="项目/群标识"
        value={scope}
        onChange={(event) => setScope(event.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => setScopeFilter(scope.trim() || undefined)}
      >
        筛选项目
      </Button>
      <Button
        size="sm"
        variant={sort === 'overdue' ? 'default' : 'outline'}
        onClick={() => setSort(sort === 'overdue' ? 'opened' : 'overdue')}
      >
        {sort === 'overdue' ? '按超时优先' : '按开启时间'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-3 px-7">
      {filterBar}
      {tickets.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          当前筛选下没有工单。请先接入来源并等待事件产生工单。
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>工单</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>项目</TableHead>
              <TableHead>负责人</TableHead>
              <TableHead>超时</TableHead>
              <TableHead>开启时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-mono text-xs">{ticket.id}</TableCell>
                <TableCell>{KIND_LABEL[ticket.kind] ?? ticket.kind}</TableCell>
                <TableCell>
                  <Badge
                    variant={ticket.status === 'open' ? 'default' : 'secondary'}
                  >
                    {ticket.status === 'open' ? '进行中' : '已结束'}
                  </Badge>
                </TableCell>
                <TableCell>{ticket.scopeKey ?? '—'}</TableCell>
                <TableCell>{ticket.assignee ?? '未指定'}</TableCell>
                <TableCell>
                  <DeadlineCell
                    overdue={ticket.overdue}
                    deadline={ticket.deadline}
                  />
                </TableCell>
                <TableCell>
                  {new Date(ticket.openedAt).toLocaleString('zh-CN')}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/tickets/${ticket.id}`}>详情</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
