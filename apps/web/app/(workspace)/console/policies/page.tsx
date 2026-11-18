import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { PoliciesPanel } from '@/features/agentic/console';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function PoliciesPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.policy.configure.code);
  if (!allowed)
    redirect(
      `/403?permission=${encodeURIComponent(PERMISSION.policy.configure.code)}`,
    );

  return (
    <Page>
      <Page.Header title="策略" description="受理强度、名单、模型与写回字段" />
      <Page.Content>
        <PoliciesPanel />
      </Page.Content>
    </Page>
  );
}
