'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

/** 页面不存在：品牌标 + 状态码 + 人话说明 + 返回工作台 / 返回上一页。 */
export default function NotFound() {
  const router = useRouter();

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
          404 · NOT FOUND
        </p>
        <h1 className="mt-3 text-[length:var(--text-title)] font-semibold">
          页面不存在
        </h1>
        <p className="mt-3 max-w-[360px] text-[length:var(--text-body)] leading-relaxed text-muted-foreground">
          你访问的地址不存在或已被移动。检查地址是否正确，或返回工作台继续使用。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Button asChild size="lg">
            <Link href="/">返回工作台</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="text-foreground"
            onClick={() => router.back()}
          >
            返回上一页
          </Button>
        </div>
      </div>
    </main>
  );
}
