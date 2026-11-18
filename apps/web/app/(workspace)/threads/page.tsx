import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { ThreadsPanel } from '@/features/agentic/threads';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

export default async function ThreadsPage() {
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
      <Page.Header title="线程" description="按外部对象聚合的事件时间线" />
      <Page.Content variant="flush">
        <ThreadsPanel />
      </Page.Content>
    </Page>
  );
}
