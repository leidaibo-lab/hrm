import { PERMISSION } from '@cip/shared';
import { redirect } from 'next/navigation';
import { Page } from '@/components/layout/page';
import { RunTracePanel } from '@/features/agentic/console';
import { getSession } from '@/lib/session';

/** 会话与权限逐请求获取。 */
export const instant = false;

/** 运行轨迹页：展示运行级审计（步骤/token 等细节待追踪数据接入）。 */
export default async function ConsolePage() {
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
      <Page.Header
        title="运行轨迹"
        description="按 traceId 查看澄清/拆解运行结果与失败原因"
      />
      <Page.Content variant="flush">
        <RunTracePanel />
      </Page.Content>
    </Page>
  );
}
