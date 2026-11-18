import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import {
  PermissionPointsExportButton,
  PermissionPointsTable,
} from '@/features/access-control';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function PermissionPointsAdminPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.permissionPoint.manage.code);
  if (!allowed) redirect('/403');
  return (
    <Page>
      <Page.Header
        title="权限点"
        description="代码目录自动收集的权限清单与摘要覆盖"
        action={<PermissionPointsExportButton />}
      />
      <Page.Content>
        <PermissionPointsTable />
      </Page.Content>
    </Page>
  );
}
