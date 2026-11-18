'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './globals.css';

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

/** 全局错误兜底：在根 layout 之外渲染，必须自带 html/body；自行引入全局样式以获得设计令牌。 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground">
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
              ERROR · 系统异常
            </p>
            <h1 className="mt-3 text-[length:var(--text-title)] font-semibold">
              页面暂时无法显示
            </h1>
            <p className="mt-3 max-w-[360px] text-[length:var(--text-body)] leading-relaxed text-muted-foreground">
              遇到一个未预期的问题。可以重试；如持续出现，请联系平台管理员。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <Button type="button" size="lg" onClick={reset}>
                重试
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-foreground"
              >
                <Link href="/">返回工作台</Link>
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
