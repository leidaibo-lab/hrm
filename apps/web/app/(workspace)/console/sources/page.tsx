import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { SourcesPanel } from '@/features/agentic/console';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function SourcesPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.source.configure.code);
  if (!allowed)
    redirect(
      `/403?permission=${encodeURIComponent(PERMISSION.source.configure.code)}`,
    );

  return (
    <Page>
      <Page.Header
        title="来源"
        description="飞书群、表格与项目接入的启停和健康"
      />
      <Page.Content variant="flush">
        <SourcesPanel />
      </Page.Content>
    </Page>
  );
}
