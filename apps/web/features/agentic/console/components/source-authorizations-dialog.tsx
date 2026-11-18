'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useAuthorizeSource,
  useRevokeSourceAuthorization,
  useSourceAuthorizations,
} from '../api/sources';

/** 来源授权管理：列出、授权与撤销范围。 */
export function SourceAuthorizationsDialog({
  sourceId,
  onClose,
}: {
  sourceId: string;
  onClose: () => void;
}) {
  const authorizations = useSourceAuthorizations(sourceId);
  const authorize = useAuthorizeSource(sourceId);
  const revoke = useRevokeSourceAuthorization(sourceId);
  const [scopeKey, setScopeKey] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  return (
    <div className="mt-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">范围授权：{sourceId}</p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          关闭
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-[180px]"
          placeholder="范围（群/项目）"
          value={scopeKey}
          onChange={(event) => setScopeKey(event.target.value)}
        />
        <Input
          className="max-w-[220px]"
          type="datetime-local"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
        <Button
          size="sm"
          disabled={authorize.isPending || !scopeKey.trim()}
          onClick={() =>
            authorize.mutate(
              {
                scopeKey: scopeKey.trim(),
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
              },
              { onSuccess: () => setScopeKey('') },
            )
          }
        >
          授权
        </Button>
      </div>
      {authorize.isError && (
        <p className="mt-1 text-xs text-destructive">
          授权失败：{authorize.error.message}
        </p>
      )}
      <div className="mt-2 space-y-1">
        {authorizations.data?.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <span className="font-mono">{item.scopeKey}</span>
            <Badge variant={item.active ? 'secondary' : 'outline'}>
              {item.active ? '有效' : '失效'}
            </Badge>
            <span className="text-muted-foreground">
              {item.expiresAt
                ? `到期 ${new Date(item.expiresAt).toLocaleString('zh-CN')}`
                : '长期'}
            </span>
            {item.active && (
              <Button
                size="sm"
                variant="outline"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(item.scopeKey)}
              >
                撤销
              </Button>
            )}
          </div>
        ))}
        {authorizations.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">
            暂无授权记录：当前实例沿用旧配置白名单。
          </p>
        )}
      </div>
    </div>
  );
}
