import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { ProvidersTable } from '@/features/model-providers';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function ModelProvidersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.modelProvider.manage.code);
  if (!allowed) redirect('/403');
  const { create } = await searchParams;
  return (
    <Page>
      <Page.Header
        title="模型服务"
        description="接入 OpenAI 兼容服务商，管理凭据、限流与连通性"
      />
      <Page.Content variant="flush">
        <ProvidersTable
          identityKey={session.user.id}
          createOpen={create === '1'}
        />
      </Page.Content>
    </Page>
  );
}
