'use client';

import { SearchIcon } from 'lucide-react';

import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

/** 侧栏命令入口：替代顶栏搜索，点击与 ⌘K 打开同一命令面板。 */
export function SidebarCommand({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="搜索或执行"
      onClick={onOpen}
      className={cn(
        'mt-3 flex h-[34px] w-full items-center gap-2 rounded-md border border-border bg-card px-2.5',
        'text-sm text-muted-foreground transition-control',
        'hover:bg-accent hover:text-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        'group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
      )}
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="truncate group-data-[collapsible=icon]:hidden">
        搜索或执行
      </span>
      <Kbd className="ml-auto font-mono text-[length:var(--text-meta)] group-data-[collapsible=icon]:hidden">
        ⌘K
      </Kbd>
    </button>
  );
}
