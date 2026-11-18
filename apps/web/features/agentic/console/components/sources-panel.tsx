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
import type { SourceHealthView, SourceView } from '../../shared/types';
import {
  useCreateSource,
  useSourceHealth,
  useSources,
  useToggleSource,
} from '../api/sources';
import { SourceAuthorizationsDialog } from './source-authorizations-dialog';
import { SourceEditDialog } from './source-edit-dialog';

function healthSummary(items: SourceHealthView[]): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (items.length === 0) return { label: '未上报', variant: 'outline' };
  if (items.some((item) => item.state === 'error'))
    return { label: '异常', variant: 'destructive' };
  if (items.every((item) => item.state === 'ready'))
    return { label: '正常', variant: 'default' };
  return { label: '启动中', variant: 'secondary' };
}

function SourceHealthCell({ id }: { id: string }) {
  const health = useSourceHealth(id);
  if (health.isPending) return <Skeleton className="h-5 w-14" />;
  if (health.isError) return <Badge variant="outline">未知</Badge>;
  const summary = healthSummary(health.data);
  return <Badge variant={summary.variant}>{summary.label}</Badge>;
}

/** 来源实例列表：启停与健康状态。 */
export function SourcesPanel() {
  const sources = useSources();
  const toggle = useToggleSource();
  const create = useCreateSource();
  const [name, setName] = useState('');
  const [chats, setChats] = useState('');
  const [botId, setBotId] = useState('');
  const [tables, setTables] = useState('');
  const [editing, setEditing] = useState<SourceView | null>(null);
  const [authorizing, setAuthorizing] = useState<string | null>(null);

  const canCreate =
    name.trim().length > 0 &&
    chats.trim().length > 0 &&
    botId.trim().length > 0 &&
    !create.isPending;

  if (sources.isPending)
    return (
      <div className="space-y-2 px-7">
        {['s1', 's2', 's3'].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );

  if (sources.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        来源列表加载失败：{sources.error.message}
      </p>
    );

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2 px-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canCreate) return;
          create.mutate(
            {
              sourceType: 'lark',
              name: name.trim(),
              config: {
                chats: chats
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
                tables: tables
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .map((item) => {
                    const [appToken, tableId] = item.split(':');
                    return { appToken, tableId };
                  })
                  .filter((item) => item.appToken && item.tableId),
                listen: 'mentions',
              },
              botId: botId.trim(),
            },
            {
              onSuccess: () => {
                setName('');
                setChats('');
                setBotId('');
                setTables('');
              },
            },
          );
        }}
      >
        <Input
          className="max-w-[180px]"
          placeholder="来源名称"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          className="max-w-[320px]"
          placeholder="群 ID，逗号分隔"
          value={chats}
          onChange={(event) => setChats(event.target.value)}
        />
        <Input
          className="max-w-[200px]"
          placeholder="机器人 open_id（必填）"
          value={botId}
          onChange={(event) => setBotId(event.target.value)}
        />
        <Input
          className="max-w-[260px]"
          placeholder="表格 appToken:tableId，逗号分隔"
          value={tables}
          onChange={(event) => setTables(event.target.value)}
        />
        <Button type="submit" disabled={!canCreate}>
          新建飞书来源
        </Button>
        {create.isError && (
          <span className="text-sm text-destructive">
            {create.error.message}
          </span>
        )}
      </form>

      {sources.data.length === 0 ? (
        <p className="px-7 text-sm text-muted-foreground">
          尚未配置来源实例。请先创建飞书来源并填入群与机器人配置。
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>健康</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.data.map((source) => (
              <TableRow key={source.id}>
                <TableCell>{source.name}</TableCell>
                <TableCell>{source.sourceType}</TableCell>
                <TableCell>
                  <Badge variant={source.enabled ? 'default' : 'secondary'}>
                    {source.enabled ? '已启用' : '已停用'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <SourceHealthCell id={source.id} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(source)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggle.isPending}
                      onClick={() =>
                        toggle.mutate({
                          id: source.id,
                          enabled: !source.enabled,
                        })
                      }
                    >
                      {source.enabled ? '停用' : '启用'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing && (
        <SourceEditDialog source={editing} onClose={() => setEditing(null)} />
      )}
      {authorizing && (
        <SourceAuthorizationsDialog
          sourceId={authorizing}
          onClose={() => setAuthorizing(null)}
        />
      )}
    </div>
  );
}
