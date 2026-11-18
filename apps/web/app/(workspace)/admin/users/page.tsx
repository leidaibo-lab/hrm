import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Page } from '@/components/layout/page';
import { UsersTable } from '@/features/access-control';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function UsersAdminPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.user.manage.code);
  if (!allowed) redirect('/403');
  return (
    <Page>
      <Page.Header title="用户" description="管理平台账号的启停与角色绑定" />
      <Page.Content variant="flush">
        <Suspense fallback={null}>
          <UsersTable identityKey={session.user.id} />
        </Suspense>
      </Page.Content>
    </Page>
  );
}
