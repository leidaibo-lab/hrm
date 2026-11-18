import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { ThreadDetailPanel } from '@/features/agentic/threads';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await getSession();
  const allowed =
    session.permissions.includes('*') ||
    session.permissions.includes(PERMISSION.ticket.read.code);
  if (!allowed)
    redirect(
      `/403?permission=${encodeURIComponent(PERMISSION.ticket.read.code)}`,
    );
  const { key } = await params;

  return (
    <Page>
      <Page.Header title="线程时间线" description={key} />
      <Page.Content variant="flush">
        <ThreadDetailPanel key={key} />
      </Page.Content>
    </Page>
  );
}
