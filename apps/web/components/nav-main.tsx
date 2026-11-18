'use client';

import type { NavigationNodeDto } from '@cip/shared';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavIcon } from '@/components/nav-icon';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

function isItemActive(item: NavigationNodeDto, pathname: string): boolean {
  return (
    item.path === pathname ||
    (item.path !== null && pathname.startsWith(`${item.path}/`))
  );
}

/** 一级目的地：无子项的域，链接 + icon rail 下的右侧 tooltip（展开态自动隐藏）。 */
function NavLeaf({
  item,
  active,
}: {
  item: NavigationNodeDto;
  active: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
        <Link
          href={item.path ?? '/'}
          aria-current={active ? 'page' : undefined}
        >
          <NavIcon name={item.icon ?? ''} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * 有子项的域：sidebar-07 block 的可折叠组——默认展开含 active 的组，
 * ChevronRight 随开合旋转；二级项挂在 SidebarMenuSub 下。
 */
function NavGroup({
  item,
  pathname,
}: {
  item: NavigationNodeDto;
  pathname: string;
}) {
  const active = isItemActive(item, pathname);
  const childActive = item.children.some((child) =>
    isItemActive(child, pathname),
  );

  return (
    <Collapsible
      asChild
      defaultOpen={childActive}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={active}>
            <NavIcon name={item.icon ?? ''} />
            <span>{item.title}</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.code}>
                <SidebarMenuSubButton
                  asChild
                  isActive={isItemActive(child, pathname)}
                  className="w-full"
                >
                  <Link
                    href={child.path ?? '/'}
                    aria-current={
                      isItemActive(child, pathname) ? 'page' : undefined
                    }
                  >
                    <NavIcon name={child.icon ?? ''} />
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/**
 * 分组导航（sidebar-07 block 模式）：无子项的域渲染为一级菜单项，有子项的域
 * 渲染为可折叠组。数据为 /me 下发的合并导航树（api 已完成权限过滤），
 * 本组件不做权限判断。
 */
export function NavMain({ items }: { items: NavigationNodeDto[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup className="px-3">
      <SidebarMenu>
        {items.map((item) =>
          item.children.length === 0 ? (
            <NavLeaf
              key={item.code}
              item={item}
              active={isItemActive(item, pathname)}
            />
          ) : (
            <NavGroup key={item.code} item={item} pathname={pathname} />
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
