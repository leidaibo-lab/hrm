'use client';

import type { NavigationNodeDto } from '@cip/shared';
import { Command } from 'cmdk';
import { MoonIcon, SearchIcon, SunIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { useAppAbility } from '@/components/can';
import { NavIcon } from '@/components/nav-icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { useRolesList, useUsersList } from '@/features/access-control/index';
import { useProvidersList } from '@/features/model-providers/index';
import { cn } from '@/lib/utils';

type PaletteAction = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
};

type PaletteEntity = { title: string; sub: string; path: string };

type PalettePage = {
  title: string;
  path: string;
  icon: string | null;
  domain: string;
};

/** 结果项：40 高，选中用品牌 tint 浅底（浮层允许阴影，条目本身不加）。 */
const paletteItemClass = cn(
  'flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2.5 outline-none',
  'text-foreground data-[selected=true]:bg-tint',
);

/** 面板底栏 keycap 提示。 */
function PaletteHints() {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t',
        'px-3 py-2 text-[length:var(--text-meta)] text-muted-foreground',
      )}
    >
      <KbdGroup className="gap-1">
        <Kbd className="font-mono">↑</Kbd>
        <Kbd className="font-mono">↓</Kbd>
        <span className="ml-1">选择</span>
      </KbdGroup>
      <KbdGroup className="gap-1">
        <Kbd className="font-mono">↵</Kbd>
        <span className="ml-1">打开</span>
      </KbdGroup>
      <KbdGroup className="gap-1">
        <Kbd className="font-mono">ESC</Kbd>
        <span className="ml-1">关闭</span>
      </KbdGroup>
      <span className="ml-auto">命令面板 · ⌘K</span>
    </div>
  );
}

/** 全局命令面板：页面跳转（按权限）+ 快捷操作 + 实体检索（按权限开启）；⌘K / Ctrl+K 触发。 */
export function CommandPalette({
  open,
  onOpenChange,
  nav,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: NavigationNodeDto[];
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  // 实体检索：仅面板打开且输入非空时拉取（组件级判定走壳层注入的 ability，
  // 与页面级 RSC 门控同一权限语义；api 权限点仍兜底）。
  const ability = useAppAbility();
  const canSearchUsers = ability.can('manage', 'user');
  const canSearchRoles = ability.can('manage', 'role');
  const canSearchProviders = ability.can('manage', 'model-provider');
  const users = useUsersList(1, 50, {
    enabled: open && searching && canSearchUsers,
    q: query.trim() || undefined,
  });
  const roles = useRolesList({
    enabled: open && searching && canSearchRoles,
    q: query.trim() || undefined,
  });
  const providers = useProvidersList({
    enabled: open && searching && canSearchProviders,
    q: query.trim() || undefined,
  });

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  // 页面导航扁平化：域下子项 + 无子项的域本身；右侧标注所属域。
  const pages: PalettePage[] = nav.flatMap((node) => {
    if (node.children.length > 0) {
      return node.children
        .filter((child) => child.path !== null)
        .map((child) => ({
          title: child.title,
          path: child.path as string,
          icon: child.icon,
          domain: node.title,
        }));
    }
    if (node.path === null) return [];
    return [
      { title: node.title, path: node.path, icon: node.icon, domain: '' },
    ];
  });

  const actions: PaletteAction[] = [
    {
      label: resolvedTheme === 'dark' ? '切换为浅色主题' : '切换为深色主题',
      icon: resolvedTheme === 'dark' ? SunIcon : MoonIcon,
      onSelect: toggleTheme,
    },
  ];

  const userEntities: PaletteEntity[] = canSearchUsers
    ? (users.data?.items ?? [])
        .map((user) => ({
          title: user.name,
          sub: user.username,
          path: '/admin/users',
        }))
        .slice(0, 5)
    : [];
  const roleEntities: PaletteEntity[] = canSearchRoles
    ? (roles.data ?? [])
        .map((role) => ({
          title: role.name,
          sub: role.code,
          path: `/admin/roles/${role.id}/edit`,
        }))
        .slice(0, 5)
    : [];
  const providerEntities: PaletteEntity[] = canSearchProviders
    ? (providers.data ?? [])
        .map((provider) => ({
          title: provider.name,
          sub: provider.slug,
          path: `/admin/ai/providers/${provider.id}/models`,
        }))
        .slice(0, 5)
    : [];

  const closeThen = (run: () => void) => {
    onOpenChange(false);
    run();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'w-[600px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border border-border p-0 shadow-overlay sm:max-w-[600px]',
        )}
      >
        <DialogTitle className="sr-only">全局搜索</DialogTitle>
        <DialogDescription className="sr-only">
          搜索页面、成员、角色或执行操作
        </DialogDescription>
        <Command
          className={cn(
            'text-muted-foreground',
            '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5',
            '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
          )}
        >
          <div
            className="flex h-11 items-center gap-2 border-b px-3"
            cmdk-input-wrapper=""
          >
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="搜索页面、成员、角色或跳转…"
              className={cn(
                'h-full min-w-0 flex-1 bg-transparent outline-none',
                'text-foreground placeholder:text-muted-foreground',
              )}
            />
            <Kbd className="font-mono">ESC</Kbd>
          </div>
          <Command.List className="max-h-[420px] overflow-x-hidden overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-[length:var(--text-body)] text-muted-foreground">
              无匹配结果
            </Command.Empty>
            <Command.Group heading="页面">
              {pages.map((page) => (
                <Command.Item
                  key={page.path}
                  value={`${page.title} ${page.domain}`}
                  onSelect={() => closeThen(() => router.push(page.path))}
                  className={paletteItemClass}
                >
                  <NavIcon
                    name={page.icon ?? ''}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{page.title}</span>
                  {!!page.domain && (
                    <span className="ml-auto shrink-0 text-[length:var(--text-meta)] text-muted-foreground">
                      {page.domain}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="快捷操作">
              {actions.map((action) => (
                <Command.Item
                  key={action.label}
                  onSelect={() => closeThen(action.onSelect)}
                  className={paletteItemClass}
                >
                  {!!action.icon && (
                    <action.icon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  {action.label}
                </Command.Item>
              ))}
            </Command.Group>
            {!!searching && (
              <Command.Group heading="成员">
                {userEntities.map((entity) => (
                  <PaletteEntityItem
                    key={`user-${entity.sub}`}
                    entity={entity}
                    onOpen={(path) => closeThen(() => router.push(path))}
                  />
                ))}
              </Command.Group>
            )}
            {!!searching && (
              <Command.Group heading="角色">
                {roleEntities.map((entity) => (
                  <PaletteEntityItem
                    key={`role-${entity.sub}`}
                    entity={entity}
                    onOpen={(path) => closeThen(() => router.push(path))}
                  />
                ))}
              </Command.Group>
            )}
            {!!searching && (
              <Command.Group heading="模型服务">
                {providerEntities.map((entity) => (
                  <PaletteEntityItem
                    key={`provider-${entity.sub}`}
                    entity={entity}
                    onOpen={(path) => closeThen(() => router.push(path))}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
          <PaletteHints />
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** 实体检索结果项：标题 + 右侧 mono 标识副行，cmdk 依输入值过滤。 */
function PaletteEntityItem({
  entity,
  onOpen,
}: {
  entity: PaletteEntity;
  onOpen: (path: string) => void;
}) {
  return (
    <Command.Item
      value={`${entity.title} ${entity.sub}`}
      onSelect={() => onOpen(entity.path)}
      className={paletteItemClass}
    >
      <span className="truncate">{entity.title}</span>
      <span
        className={cn(
          'ml-auto shrink-0 font-mono text-[length:var(--text-meta)]',
          'text-muted-foreground',
        )}
      >
        {entity.sub}
      </span>
    </Command.Item>
  );
}

/** ⌘K / Ctrl+K 快捷键监听。 */
export function useCommandPaletteKey(setOpen: (open: boolean) => void): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);
}
