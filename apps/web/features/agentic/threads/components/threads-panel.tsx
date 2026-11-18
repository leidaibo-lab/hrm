'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useThreads } from '../api/threads';

/** 最近线程列表。 */
export function ThreadsPanel() {
  const threads = useThreads(50);

  if (threads.isPending)
    return (
      <div className="space-y-2 px-7">
        {['s1', 's2', 's3', 's4', 's5'].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );

  if (threads.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        线程列表加载失败：{threads.error.message}
      </p>
    );

  if (threads.data.length === 0)
    return (
      <p className="px-7 text-sm text-muted-foreground">
        暂无线程。群消息接入后会形成线程时间线。
      </p>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>线程</TableHead>
          <TableHead>来源</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>最近事件</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {threads.data.map((thread) => (
          <TableRow key={thread.id}>
            <TableCell className="max-w-[360px] truncate font-mono text-xs">
              {thread.externalKey}
            </TableCell>
            <TableCell>{thread.sourceType}</TableCell>
            <TableCell>
              <Badge
                variant={thread.status === 'open' ? 'default' : 'secondary'}
              >
                {thread.status}
              </Badge>
            </TableCell>
            <TableCell>
              {thread.lastEventAt
                ? new Date(thread.lastEventAt).toLocaleString('zh-CN')
                : '—'}
            </TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/threads/${encodeURIComponent(thread.externalKey)}`}
                >
                  时间线
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
