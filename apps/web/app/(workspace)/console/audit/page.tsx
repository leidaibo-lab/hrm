import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { AuditPanel } from '@/features/agentic/console';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function AuditPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.audit.read.code);
  if (!allowed)
    redirect(
      `/403?permission=${encodeURIComponent(PERMISSION.audit.read.code)}`,
    );

  return (
    <Page>
      <Page.Header title="审计" description="决策与操作的审计记录" />
      <Page.Content variant="flush">
        <AuditPanel />
      </Page.Content>
    </Page>
  );
}
