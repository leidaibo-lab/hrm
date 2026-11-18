import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { ModelDetail } from '@/features/model-providers';
import { getSession } from '@/lib/session';

/** 模型详情页：能力编辑与价格版本管理。 */
/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string; modelId: string }>;
}) {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.modelProvider.manage.code);
  if (!allowed) redirect('/403');
  const { modelId } = await params;
  return (
    <Page>
      <Page.Header title="模型详情" description="能力编辑与价格版本管理" />
      <Page.Content>
        <ModelDetail modelId={modelId} />
      </Page.Content>
    </Page>
  );
}
