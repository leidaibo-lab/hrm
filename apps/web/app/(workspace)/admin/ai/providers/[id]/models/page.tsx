import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { ModelsPanel } from '@/features/model-providers';
import { getSession } from '@/lib/session';

/** 服务商下的模型管理页：注册、目录导入与删除保护。 */
/** 会话与权限逐请求获取，此路由允许阻塞导航。 */
export const instant = false;

export default async function ProviderModelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ create?: string; import?: string }>;
}) {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.modelProvider.manage.code);
  if (!allowed) redirect('/403');
  const { id } = await params;
  const { create, import: importOpen } = await searchParams;
  return (
    <Page>
      <Page.Header
        title="模型管理"
        description="注册模型、从模型目录导入基线，并配置能力与价格"
      />
      <Page.Content variant="flush">
        <ModelsPanel
          identityKey={session.user.id}
          providerId={id}
          createOpen={create === '1'}
          importOpen={importOpen === '1'}
        />
      </Page.Content>
    </Page>
  );
}
