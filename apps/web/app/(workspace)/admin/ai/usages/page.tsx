import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { UsageReport } from '@/features/model-providers';
import { getSession } from '@/lib/session';

/** 用量报表页：模型调用计量的聚合与明细。 */
/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function ModelUsagesPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.modelProvider.manage.code);
  if (!allowed) redirect('/403');
  return (
    <Page>
      <Page.Header title="用量报表" description="模型调用的聚合统计与明细" />
      <Page.Content variant="flush">
        <UsageReport identityKey={session.user.id} />
      </Page.Content>
    </Page>
  );
}
