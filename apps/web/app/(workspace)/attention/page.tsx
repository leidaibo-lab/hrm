import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { AttentionPanel } from '@/features/agentic/attention';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function AttentionPage() {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.ticket.read.code);
  if (!allowed)
    redirect(
      `/403?permission=${encodeURIComponent(PERMISSION.ticket.read.code)}`,
    );

  return (
    <Page>
      <Page.Header
        title="待办关注"
        description="需要人确认、澄清或评审的问题"
      />
      <Page.Content>
        <AttentionPanel />
      </Page.Content>
    </Page>
  );
}
