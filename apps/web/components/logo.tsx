import { cn } from '@/lib/utils';

/** 品牌标几何(E1/E2 双版本,见 docs 决策:方案 L「ci 合抱」)。 */
const LOGO_PATHS = {
  /** E1 悬浮点:主色点浮在开口上方,品牌默认。 */
  ring: {
    c: 'M 58.91 26.70 A 26 26 0 1 0 58.91 69.30',
    stem: 'M 70 38 L 70 60',
    dot: { cx: 70.5, cy: 22, r: 6 },
  },
  /** E2 落点 i:主色点贴杆成真 i,间隙更少,≤20px 小尺寸更稳。 */
  compact: {
    c: 'M 57.78 25.95 A 26 26 0 1 0 57.78 70.05',
    stem: 'M 70 32 L 70 60',
    dot: { cx: 70, cy: 25, r: 6.5 },
  },
} as const;

type LogoProps = {
  /** 渲染边长(px)。 */
  size?: number;
  /** ring=E1 悬浮点(默认);compact=E2 落点 i(小尺寸)。 */
  variant?: keyof typeof LOGO_PATHS;
  /** 覆盖主题色:默认取 --primary;常暗面板可传入固定色,经 cn 合并后者生效。 */
  className?: string;
};

/** 品牌标「ci 合抱」:C(collaborative)怀抱 I(intelligence),主色点取 --primary(随主题切换)。 */
export function Logo({ size = 24, variant = 'ring', className }: LogoProps) {
  const paths = LOGO_PATHS[variant];
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className={cn('stroke-foreground', className)}
    >
      <path d={paths.c} strokeWidth={10} strokeLinecap="round" />
      <path d={paths.stem} strokeWidth={10} strokeLinecap="round" />
      <circle
        cx={paths.dot.cx}
        cy={paths.dot.cy}
        r={paths.dot.r}
        className="fill-primary"
        stroke="none"
      />
    </svg>
  );
}
