import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/session';

/** 平台管理域的聚合权限点：持有任一即可进入，页面内各自校验具体权限。 */
const ADMIN_PERMISSION_CODES = [
  PERMISSION.user.manage.code,
  PERMISSION.role.manage.code,
  PERMISSION.navigation.manage.code,
  PERMISSION.permissionPoint.manage.code,
];

/** 平台后台域布局：会话 + 管理权限聚合校验（无权 403；页面级细粒度由各页权限点保证）。 */
/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const isAdmin =
    session.permissions.includes('*') ||
    ADMIN_PERMISSION_CODES.some((code) => session.permissions.includes(code));
  if (!isAdmin) {
    redirect('/403');
  }
  // 零容器：不做宽度约束与 padding，布局交由 Page 复合组件（flush 列表满幅）。
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
