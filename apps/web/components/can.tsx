'use client';

import { Can as CaslCan, useAbility } from '@casl/react';
import type {
  AppAbility,
  PermissionAction,
  PermissionSubject,
} from '@cip/shared';
import type { ReactNode } from 'react';

/** 取客户端注入的 AppAbility（组件内命令式判断用）。 */
export function useAppAbility(): AppAbility {
  return useAbility<AppAbility>();
}

/** 组件级权限门控：仅 UI 显隐，非安全边界；resource 为权限点 code 的资源段（kebab 形态）。 */
export function Can({
  action,
  resource,
  children,
}: {
  action: PermissionAction;
  resource: PermissionSubject;
  children: ReactNode;
}) {
  return (
    <CaslCan I={action} a={resource}>
      {() => children}
    </CaslCan>
  );
}
