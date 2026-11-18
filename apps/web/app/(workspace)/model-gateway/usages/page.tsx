import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { UsagesPanel } from '@/features/model-gateway';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

/**
 * 模型网关用量控制台：成本汇总与最近尝试。
 * @returns 页面元素。
 */
export default async function ModelGatewayUsagesPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.modelGateway.read.code);
  if (!allowed) redirect('/403');
  return (
    <Page>
      <Page.Header
        title="模型网关用量"
        description="按空间与 Agent 归因的成本汇总"
      />
      <Page.Content>
        <UsagesPanel />
      </Page.Content>
    </Page>
  );
}
