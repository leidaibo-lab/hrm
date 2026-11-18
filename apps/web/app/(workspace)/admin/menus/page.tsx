import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { MenusEditor } from '@/features/access-control';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function MenusAdminPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.navigation.manage.code);
  if (!allowed) redirect('/403');
  return (
    <Page>
      <Page.Header title="菜单" description="定制导航的展示文案、图标与显隐" />
      <Page.Content>
        <MenusEditor />
      </Page.Content>
    </Page>
  );
}
