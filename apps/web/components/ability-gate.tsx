'use client';

import { AbilityProvider } from '@casl/react';
import { type AppAbility, buildAbility } from '@cip/shared';
import { type ReactNode, useMemo } from 'react';

/**
 * 客户端 ability 注入：服务端把会话权限点集合经 props 下发，客户端构建同一语义的 AppAbility。
 * 仅用于 UI 显隐（<Can>）；真正的安全边界在 api guard。
 */
export function AbilityGate({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: ReactNode;
}) {
  const ability = useMemo<AppAbility>(
    () => buildAbility(permissions),
    [permissions],
  );
  return <AbilityProvider value={ability}>{children}</AbilityProvider>;
}
