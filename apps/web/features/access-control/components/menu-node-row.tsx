'use client';

import { GripVerticalIcon } from 'lucide-react';

import { NavIcon } from '@/components/nav-icon';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/** 导航节点视图：代码目录与展示覆盖合并后的字段。 */
export type MenuNodeView = {
  /** 业务编码。 */
  code: string;
  /** 父级编码。 */
  parentCode: string | null;
  /** 标题。 */
  title: string | null;
  /** 默认标题。 */
  defaultTitle: string;
  /** 图标。 */
  icon: string | null;
  /** 默认图标。 */
  defaultIcon: string | null;
  /** 排序值。 */
  sort: number | null;
  /** 默认排序值。 */
  defaultSort: number;
  /** 是否可见。 */
  visible: boolean;
  /** 权限点编码。 */
  permissionCode: string | null;
};

/** 树节点：一个导航节点及其子节点。 */
export type MenuNodeTreeItem = {
  /** 当前菜单节点。 */
  node: MenuNodeView;
  /** 子项集合。 */
  children: MenuNodeTreeItem[];
};

/** 树行：缩进表层级；零容器列表，选中用 tint；动作按钮与开关为并列兄弟节点。 */
export function MenuNodeRow({
  item,
  depth,
  selectedCode,
  onSelect,
  onToggle,
}: {
  item: MenuNodeTreeItem;
  depth: number;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  onToggle: (node: MenuNodeView) => void;
}): React.ReactNode {
  const node = item.node;
  const isSelected = selectedCode === node.code;
  const overridden =
    node.title !== null || node.icon !== null || node.sort !== null;
  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 pr-3 transition-control',
          isSelected ? 'bg-tint' : 'hover:bg-muted/50',
        )}
      >
        <button
          type="button"
          role="treeitem"
          aria-selected={isSelected}
          onClick={() => onSelect(node.code)}
          style={{ paddingLeft: 12 + depth * 20 }}
          className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left text-[length:var(--text-body)]"
        >
          {depth === 0 && (
            <GripVerticalIcon className="size-3.5 shrink-0 text-faint" />
          )}
          <NavIcon name={node.icon ?? node.defaultIcon ?? ''} />
          <span className="truncate font-medium">
            {node.title ?? node.defaultTitle}
          </span>
          {overridden && (
            <span className="shrink-0 text-[length:var(--text-meta)] text-muted-foreground">
              已覆盖
            </span>
          )}
        </button>
        <Switch
          size="sm"
          checked={node.visible}
          onCheckedChange={() => onToggle(node)}
          aria-label={`在导航中${node.visible ? '隐藏' : '显示'}${node.title ?? node.defaultTitle}`}
        />
      </div>
      {item.children.length > 0 && (
        <div className="ml-4 border-l border-border">
          {item.children.map((child) => (
            <MenuNodeRow
              key={child.node.code}
              item={child}
              depth={depth + 1}
              selectedCode={selectedCode}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  );
}
