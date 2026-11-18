import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconSize = 12 | 14 | 16 | 18;

const ICON_SIZE_CLASS: Record<IconSize, string> = {
  12: 'size-3',
  14: 'size-3.5',
  16: 'size-4',
  18: 'size-[18px]',
};

/**
 * 统一图标包装（UIC-7.4）：默认 16px、stroke 1.5，颜色跟随文字角色；
 * 表格单元格等紧凑区用 12/14px，正文与工具栏用 16/18px。装饰性图标默认 aria-hidden。
 */
export function Icon({
  icon: Lucide,
  size = 16,
  className,
  strokeWidth = 1.5,
}: {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <Lucide
      className={cn('shrink-0', ICON_SIZE_CLASS[size], className)}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden
    />
  );
}
