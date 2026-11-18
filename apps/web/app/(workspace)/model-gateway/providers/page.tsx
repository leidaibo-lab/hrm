import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { ProvidersPanel } from '@/features/model-gateway';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

/**
 * 模型网关供应商控制台：只读列表，写操作后续批次接入。
 * @returns 页面元素。
 */
export default async function ModelGatewayProvidersPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.modelGateway.read.code);
  if (!allowed) redirect('/403');
  return (
    <Page>
      <Page.Header
        title="模型网关"
        description="供应商、健康与接入点；价格与目录维护后续接入"
      />
      <Page.Content>
        <ProvidersPanel />
      </Page.Content>
    </Page>
  );
}
