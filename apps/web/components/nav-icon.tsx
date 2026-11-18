import type { LucideIcon } from 'lucide-react';
import {
  BotIcon,
  CircleIcon,
  GaugeIcon,
  InboxIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  MenuIcon,
  RouteIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react';

/**
 * 导航图标键 → Lucide 组件映射。
 * 键的合法清单以 packages/shared 的 ICONS 为唯一事实源；此处只登记渲染映射。
 * 未登记的键渲染占位圆点，避免崩溃。
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboardIcon,
  settings: SettingsIcon,
  users: UsersIcon,
  shield: ShieldIcon,
  menu: MenuIcon,
  'key-round': KeyRoundIcon,
  bot: BotIcon,
  gauge: GaugeIcon,
  inbox: InboxIcon,
  route: RouteIcon,
};

/** 未登记的键渲染占位圆点，避免崩溃。 */
export function NavIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = NAV_ICONS[name] ?? CircleIcon;
  return <Icon className={className} />;
}
