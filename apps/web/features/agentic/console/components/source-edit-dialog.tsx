'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { SourceView } from '../../shared/types';
import { useUpdateSource } from '../api/sources';

/** 来源编辑：名称、群列表与机器人标识。 */
export function SourceEditDialog({
  source,
  onClose,
}: {
  source: SourceView;
  onClose: () => void;
}) {
  const update = useUpdateSource();
  const [name, setName] = useState(source.name);
  const [chats, setChats] = useState(
    Array.isArray(source.config.chats)
      ? (source.config.chats as string[]).join(',')
      : '',
  );
  const [botId, setBotId] = useState(source.botId ?? '');
  const [tables, setTables] = useState(
    Array.isArray(source.config.tables)
      ? (source.config.tables as Array<{ appToken: string; tableId: string }>)
          .map((table) => `${table.appToken}:${table.tableId}`)
          .join(',')
      : '',
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑来源</DialogTitle>
          <DialogDescription>
            修改名称与接收范围；配置会重新经适配器校验。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm">
            <span>名称</span>
            <Input
              aria-label="名称"
              className="mt-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="text-sm">
            <span>群 ID，逗号分隔</span>
            <Input
              aria-label="群 ID，逗号分隔"
              className="mt-1"
              value={chats}
              onChange={(event) => setChats(event.target.value)}
            />
          </div>
          <div className="text-sm">
            <span>机器人 open_id</span>
            <Input
              aria-label="机器人 open_id"
              className="mt-1"
              value={botId}
              onChange={(event) => setBotId(event.target.value)}
            />
          </div>
          <div className="text-sm">
            <span>表格 appToken:tableId，逗号分隔</span>
            <Input
              aria-label="表格配置"
              className="mt-1"
              value={tables}
              onChange={(event) => setTables(event.target.value)}
            />
          </div>
          {update.isError && (
            <p className="text-sm text-destructive">{update.error.message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={update.isPending || name.trim().length === 0}
            onClick={() =>
              update.mutate(
                {
                  id: source.id,
                  name: name.trim(),
                  config: {
                    ...source.config,
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
                  },
                  botId: botId.trim() ? botId.trim() : null,
                },
                { onSuccess: onClose },
              )
            }
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
