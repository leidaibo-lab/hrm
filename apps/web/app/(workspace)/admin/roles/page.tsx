import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { RolesTable } from '@/features/access-control';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function RolesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.role.manage.code);
  if (!allowed) redirect('/403');
  const { create } = await searchParams;
  return (
    <Page>
      <Page.Header title="角色" description="管理平台角色与权限授予" />
      <Page.Content variant="flush">
        <RolesTable identityKey={session.user.id} createOpen={create === '1'} />
      </Page.Content>
    </Page>
  );
}
