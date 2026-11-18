/**
 * 可配置图标键清单（纯数据，无 React 依赖）：后台图标选择器与导航目录的唯一取值来源。
 * DB 只存键字符串；键 → 组件的映射在 web 的 components/nav-icon.tsx。
 * 新增图标：登记条目 + 在 nav-icon.tsx 登记映射，两处键名一致。
 */
export const ICONS = [
  { key: 'layout-dashboard', name: '仪表盘' },
  { key: 'settings', name: '设置' },
  { key: 'users', name: '用户' },
  { key: 'shield', name: '角色' },
  { key: 'menu', name: '菜单' },
  { key: 'key-round', name: '权限' },
  { key: 'bot', name: '模型服务' },
  { key: 'gauge', name: '用量' },
  { key: 'inbox', name: '收件箱' },
  { key: 'route', name: '路线' },
] as const;

/** 合法图标键联合：取自 {@link ICONS} 的 key。 */
export type IconKey = (typeof ICONS)[number]['key'];

/**
 * 判定字符串是否为合法图标键。
 * @param value - 待判定字符串（DB 覆盖列读取值）。
 * @returns 合法为 true；非法键在合并时回退目录默认图标。
 */
export function isIconKey(value: string): value is IconKey {
  return ICONS.some((icon) => icon.key === value);
}
