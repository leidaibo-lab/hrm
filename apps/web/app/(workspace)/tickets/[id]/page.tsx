import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { TicketDetailPanel } from '@/features/agentic/tickets';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.ticket.read.code);
  if (!allowed)
    redirect(
      `/403?permission=${encodeURIComponent(PERMISSION.ticket.read.code)}`,
    );
  const canReadAudit =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.audit.read.code);
  const { id } = await params;

  return (
    <Page>
      <Page.Header title="工单详情" description={id} />
      <Page.Content variant="flush">
        <TicketDetailPanel id={id} canReadAudit={canReadAudit} />
      </Page.Content>
    </Page>
  );
}
