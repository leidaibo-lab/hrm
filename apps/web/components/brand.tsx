import Link from 'next/link';

import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

/** 品牌位：「ci 合抱」标 + 平台名（非多租户，静态品牌，无切换语义）。 */
export function Brand() {
  return (
    <Link
      href="/"
      aria-label="CIP 平台首页"
      className={cn(
        'flex h-12 items-center gap-2.5 rounded-md px-2',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
        'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
      )}
    >
      <Logo size={26} />
      <span className="grid min-w-0 group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm leading-tight font-semibold text-foreground">
          CIP 平台
        </span>
        <span className="truncate text-[length:var(--text-meta)] text-muted-foreground">
          协同智能平台
        </span>
      </span>
    </Link>
  );
}
