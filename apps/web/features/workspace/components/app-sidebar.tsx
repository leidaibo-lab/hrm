'use client';

import type { NavigationNodeDto } from '@cip/shared';
import { Brand } from '@/components/brand';
import { NavMain } from '@/components/nav-main';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NavUser } from './nav-user';
import { SidebarCommand } from './sidebar-command';

/** 侧栏组合壳：只负责拼装品牌位 / 命令入口 / 分组导航 / 用户菜单，不持有导航数据。 */
export function AppSidebar({
  nav,
  user,
  onOpenCommand,
}: {
  nav: NavigationNodeDto[];
  user: { name: string; email: string | null };
  onOpenCommand: () => void;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0 px-3 pt-3 pb-0">
        <Brand />
        <SidebarCommand onOpen={onOpenCommand} />
      </SidebarHeader>
      <SidebarContent className="mt-2">
        <NavMain items={nav} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 pt-3 pb-3">
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
