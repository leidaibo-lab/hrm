import { PERMISSION } from '@cip/shared';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { RoleSettingsEditor } from '@/features/access-control';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function RoleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.role.manage.code);
  if (!allowed) redirect('/403');
  return (
    <Page>
      <Page.Header
        title="编辑角色"
        description="维护基本信息、权限授予与删除"
        action={
          <Button asChild variant="outline">
            <Link href="/admin/roles">返回列表</Link>
          </Button>
        }
      />
      <Page.Content>
        <div className="w-full max-w-[760px]">
          <RoleSettingsEditor roleId={id} />
        </div>
      </Page.Content>
    </Page>
  );
}
