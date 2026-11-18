import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { TicketsPanel } from '@/features/agentic/tickets';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function TicketsPage() {
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
        title="工单"
        description="agentic 托管的研发任务：需求、缺陷与发布"
      />
      <Page.Content variant="flush">
        <TicketsPanel />
      </Page.Content>
    </Page>
  );
}
