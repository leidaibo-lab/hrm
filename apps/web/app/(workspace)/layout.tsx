import type { ReactNode } from 'react';
import { WorkspaceShell } from '@/features/workspace';
import { getSession } from '@/lib/session';

/** 整域由会话驱动（/me），阻塞渲染（cacheComponents）。 */
export const instant = false;

/**
 * 主应用域布局（RSC）：会话 → /me 下发的合并导航树 → 壳。
 * 直连无权路由的 403 校验由各域 layout 承担（菜单隐藏不是安全边界）。
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  return (
    <WorkspaceShell
      nav={session.navigation}
      user={{ name: session.user.name, email: session.user.email }}
      permissions={session.permissions}
    >
      {children}
    </WorkspaceShell>
  );
}
