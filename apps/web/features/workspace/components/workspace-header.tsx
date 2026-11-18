'use client';

import type { NavigationNodeDto } from '@cip/shared';
import { BellIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Fragment, useMemo } from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * 顶栏（z1 粘滞层）：折叠开关 + 面包屑 + 通知 / 主题切换，仅 hairline 分隔。
 * 全局搜索统一进侧栏命令入口与 ⌘K，不在顶栏重复出按钮。
 */
export function WorkspaceHeader({ nav }: { nav: NavigationNodeDto[] }) {
  const pathname = usePathname();

  // 面包屑随路由解析：导航树中命中当前路径的 域 → 页面 链条。
  const crumbs = useMemo(() => {
    const matched: { title: string; path: string | null }[] = [];
    for (const node of nav) {
      const self =
        node.path !== null &&
        (pathname === node.path || pathname === `${node.path}/`);
      const child = node.children.find(
        (item) => item.path !== null && pathname.startsWith(item.path),
      );
      if (self || child) {
        matched.push({ title: node.title, path: node.path });
        if (child) matched.push({ title: child.title, path: child.path });
        break;
      }
    }
    return matched;
  }, [nav, pathname]);

  return (
    <header className="sticky top-0 z-10 h-13 shrink-0 border-b bg-background">
      <div className="flex h-full w-full items-center gap-2 px-5">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList className="text-[length:var(--text-meta)]">
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/">CIP</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block">
              /
            </BreadcrumbSeparator>
            {crumbs.length > 0 ? (
              crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                const key = crumb.path ?? crumb.title;
                return (
                  <Fragment key={key}>
                    {index > 0 && (
                      <BreadcrumbSeparator className="hidden md:block">
                        /
                      </BreadcrumbSeparator>
                    )}
                    <BreadcrumbItem
                      className={index > 0 ? 'hidden md:block' : undefined}
                    >
                      {isLast ? (
                        <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.path ?? '/'}>
                          {crumb.title}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>工作台</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="通知"
                className="text-muted-foreground hover:text-foreground"
              >
                <BellIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>通知</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <p className="px-2 py-6 text-center text-[length:var(--text-body)] text-muted-foreground">
                暂无通知
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
