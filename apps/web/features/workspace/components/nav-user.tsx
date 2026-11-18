'use client';

import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLogout } from '@/features/auth';
import { cn } from '@/lib/utils';

/** 用户菜单：会话信息展示与退出登录（POST /auth/logout 后回登录页）。 */
export function NavUser({
  user,
}: {
  user: { name: string; email: string | null };
}) {
  const { isMobile } = useSidebar();
  const logout = useLogout();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn(
                'h-11 rounded-md px-2',
                'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
              )}
            >
              <Avatar className="size-7 rounded-full">
                <AvatarFallback className="rounded-full text-[length:var(--text-meta)]">
                  {user.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[length:var(--text-body)] font-medium text-sidebar-foreground">
                  {user.name}
                </span>
                <span className="truncate text-[length:var(--text-meta)] text-muted-foreground">
                  {user.email ?? '未绑定邮箱'}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1 text-left">
                <Avatar className="size-7 rounded-full">
                  <AvatarFallback className="rounded-full text-[length:var(--text-meta)]">
                    {user.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 leading-tight">
                  <span className="truncate text-[length:var(--text-body)] font-medium">
                    {user.name}
                  </span>
                  <span className="truncate text-[length:var(--text-meta)] text-muted-foreground">
                    {user.email ?? '未绑定邮箱'}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <SettingsIcon />
              个人设置
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout.mutateAsync()}>
              <LogOutIcon />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
