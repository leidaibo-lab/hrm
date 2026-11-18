import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** 会话与查询参数逐请求获取：允许阻塞式渲染。 */
export const instant = false;

/** 静默信号环：错误页统一视觉，仅发丝线与信号点，无动画。 */
function SignalRings() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 520 520"
      className="pointer-events-none absolute inset-0 m-auto size-[520px] max-w-none"
    >
      <g fill="none" className="stroke-border">
        <circle cx="260" cy="260" r="90" />
        <circle cx="260" cy="260" r="150" />
        <circle cx="260" cy="260" r="210" />
      </g>
      <circle cx="260" cy="170" r="3.6" className="fill-primary" />
      <circle cx="350" cy="260" r="2.6" className="fill-faint" />
      <circle cx="170" cy="260" r="2.6" className="fill-faint" />
    </svg>
  );
}

/** 无权访问页：品牌标 + 状态码 + 所需权限点 + 返回工作台（无「查看权限」路由，不设死链）。 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ permission?: string }>;
}) {
  const { permission } = await searchParams;
  return (
    <main
      className={cn(
        'relative flex min-h-svh flex-col items-center justify-center overflow-hidden',
        'px-6 py-16 text-center',
      )}
    >
      <SignalRings />
      <div className="relative flex max-w-[440px] flex-col items-center">
        <Logo size={36} />
        <p className="mt-5 font-mono text-[length:var(--text-meta)] tracking-[0.12em] text-primary">
          403 · FORBIDDEN
        </p>
        <h1 className="mt-3 text-[length:var(--text-title)] font-semibold">
          你没有访问这个页面的权限
        </h1>
        <p className="mt-3 max-w-[360px] text-[length:var(--text-body)] leading-relaxed text-muted-foreground">
          当前账号未被授予此页面的访问权限。如需开通，请联系平台管理员；或在下方回到你有权限的工作台。
        </p>
        {permission && (
          <p className="mt-3 font-mono text-[length:var(--text-meta)] text-muted-foreground">
            所需权限点：{permission}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Button asChild size="lg">
            <Link href="/">返回工作台</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
