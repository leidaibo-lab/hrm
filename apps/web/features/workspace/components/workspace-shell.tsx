'use client';

import type { NavigationNodeDto } from '@cip/shared';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { AbilityGate } from '@/components/ability-gate';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from './app-sidebar';
import { CommandPalette, useCommandPaletteKey } from './command-palette/index';
import { WorkspaceHeader } from './workspace-header';

/** 主应用壳：侧栏 + 顶栏 + 内容区。导航数据为 /me 下发的合并树，由 RSC layout 注入。 */
export function WorkspaceShell({
  nav,
  user,
  permissions,
  children,
}: {
  nav: NavigationNodeDto[];
  user: { name: string; email: string | null };
  permissions: readonly string[];
  children: ReactNode;
}) {
  // 侧栏展开态收归壳层：1024~1279 自动 icon rail，≥1280 自动展开；内容 padding 归 Page 复合组件。
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteKey(setPaletteOpen);

  useEffect(() => {
    const railQuery = window.matchMedia(
      '(min-width: 1024px) and (max-width: 1279px)',
    );
    const wideQuery = window.matchMedia('(min-width: 1280px)');
    const apply = () => {
      if (railQuery.matches) setSidebarOpen(false);
      if (wideQuery.matches) setSidebarOpen(true);
    };
    apply();
    railQuery.addEventListener('change', apply);
    wideQuery.addEventListener('change', apply);
    return () => {
      railQuery.removeEventListener('change', apply);
      wideQuery.removeEventListener('change', apply);
    };
  }, []);

  const openCommand = useCallback(() => {
    setPaletteOpen(true);
  }, []);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="h-svh min-h-0 overflow-hidden"
    >
      {/* ability 基座在壳层挂载一次：组件级显隐统一走 <Can>/useAppAbility（AUT-7.1），安全边界仍在 api guard。 */}
      <AbilityGate permissions={permissions}>
        <TooltipProvider delayDuration={0}>
          <AppSidebar nav={nav} user={user} onOpenCommand={openCommand} />
          <SidebarInset className="min-h-0 overflow-hidden">
            <WorkspaceHeader nav={nav} />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {children}
            </div>
          </SidebarInset>
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            nav={nav}
          />
        </TooltipProvider>
      </AbilityGate>
    </SidebarProvider>
  );
}
