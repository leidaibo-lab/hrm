import { type IconKey, isIconKey } from '../icons';
import { NAVIGATION_CATALOG, type NavigationNodeDef } from './nodes';

/** DB 投影行中参与合并的字段（NavigationNode 表的覆盖列与可见性开关）。 */
export interface NavigationOverrideRow {
  /** 业务编码。 */
  code: string;
  /** 标题。 */
  title: string | null;
  /** 图标。 */
  icon: string | null;
  /** 排序值。 */
  sort: number | null;
  /** 是否可见。 */
  visible: boolean;
}

/** /me 下发的导航树节点：api 已完成覆盖合并与可见性过滤，web 直接渲染。 */
export interface MergedNavigationNode {
  /** 业务编码。 */
  code: string;
  /** 父级编码。 */
  parentCode: string | null;
  /** 路径。 */
  path: string | null;
  /** 标题。 */
  title: string;
  /** 图标。 */
  icon: IconKey | null;
  /** 排序值。 */
  sort: number;
  /** 子项集合。 */
  children: MergedNavigationNode[];
}

function isPermitted(
  permissionCode: string | null,
  permissions: readonly string[],
): boolean {
  return (
    !permissionCode ||
    permissions.includes('*') ||
    permissions.includes(permissionCode)
  );
}

/**
 * 合并导航目录与 DB 覆盖行，输出最终导航树。
 * 规则：覆盖列非空且合法才生效，否则回退目录默认；
 * visible=false 或无权限的节点被移除；目录中声明了子节点的域若子节点全部被裁，整域隐藏。
 * @param overrides - NavigationNode 投影行（api 从 DB 读取）。
 * @param permissions - 当前会话权限点集合，"*" 表示全量。
 * @returns 按各层 sort 升序排列的导航树。
 */
export function mergeNavigation(
  overrides: readonly NavigationOverrideRow[],
  permissions: readonly string[],
): MergedNavigationNode[] {
  const overrideByCode = new Map(overrides.map((row) => [row.code, row]));
  const declaredParents = new Set(
    NAVIGATION_CATALOG.map((def: NavigationNodeDef) => def.parentCode).filter(
      (code): code is string => code !== null,
    ),
  );

  const merged = new Map<string, MergedNavigationNode>();
  for (const [index, def] of NAVIGATION_CATALOG.entries()) {
    const row = overrideByCode.get(def.code);
    if (row && !row.visible) continue;
    if (!isPermitted(def.permissionCode, permissions)) continue;
    const icon = row?.icon != null && isIconKey(row.icon) ? row.icon : def.icon;
    merged.set(def.code, {
      code: def.code,
      parentCode: def.parentCode,
      path: def.path,
      title: row?.title ?? def.title,
      icon,
      sort: row?.sort ?? (index + 1) * 10,
      children: [],
    });
  }

  const roots: MergedNavigationNode[] = [];
  for (const def of NAVIGATION_CATALOG) {
    const node = merged.get(def.code);
    if (!node) continue;
    if (node.parentCode === null) {
      roots.push(node);
    } else {
      merged.get(node.parentCode)?.children.push(node);
    }
  }

  const kept = roots.filter(
    (node) => !declaredParents.has(node.code) || node.children.length > 0,
  );
  const sortTree = (nodes: MergedNavigationNode[]): MergedNavigationNode[] =>
    nodes
      .sort((a, b) => a.sort - b.sort)
      .map((node) => ({ ...node, children: sortTree(node.children) }));
  return sortTree(kept);
}
