import { Cpu, ShieldCheck, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

type Capability = {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  desc: string;
};

/** 左栏三条能力说明：来自产品事实，不写口号。 */
const CAPABILITIES: Capability[] = [
  { icon: Users, title: '统一身份', desc: '一套凭证走遍内部系统' },
  { icon: ShieldCheck, title: '权限即视图', desc: '每个系统只呈现你该看到的' },
  { icon: Cpu, title: '模型能力', desc: '统一的模型接入与用量治理' },
];

/** 静态「信号场」：约 10 个点与发丝线构成的组织网络，唯一主色点为视觉信号；无动画。 */
function SignalField() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
    >
      <g className="stroke-border" strokeWidth="1" opacity="0.9">
        <path d="M470 190 560 250 640 210" />
        <path d="M470 190 430 300 520 350 560 250" />
        <path d="M560 250 640 330 600 430" />
        <path d="M430 300 360 380 440 450 520 350" />
        <path d="M600 430 520 500 440 450" />
        <path d="M640 210 690 290 640 330" />
      </g>
      <g className="fill-faint" opacity="0.9">
        <circle cx="470" cy="190" r="2.4" />
        <circle cx="560" cy="250" r="2.4" />
        <circle cx="640" cy="210" r="2.4" />
        <circle cx="430" cy="300" r="2.4" />
        <circle cx="520" cy="350" r="2.4" />
        <circle cx="640" cy="330" r="2.4" />
        <circle cx="600" cy="430" r="2.4" />
        <circle cx="360" cy="380" r="2.4" />
        <circle cx="440" cy="450" r="2.4" />
        <circle cx="520" cy="500" r="2.4" />
        <circle cx="690" cy="290" r="2.4" />
      </g>
      <circle
        cx="560"
        cy="250"
        r="8"
        strokeWidth="1.5"
        strokeOpacity="0.35"
        className="stroke-primary"
      />
      <circle cx="560" cy="250" r="3.4" className="fill-primary" />
      <circle
        cx="470"
        cy="190"
        r="14"
        strokeWidth="1"
        strokeOpacity="0.12"
        className="stroke-primary"
      />
    </svg>
  );
}

/**
 * 认证页品牌叙事栏：中性底 + 静态信号场，文案说明产品事实。
 * 移动端保留品牌行与标题，隐藏信号场、能力列表与版权；桌面端为常驻左栏。
 */
export function AuthAside() {
  return (
    <aside
      className={cn(
        'relative flex flex-col overflow-hidden border-b border-border bg-secondary',
        'px-6 pt-6 pb-8',
        'lg:border-r lg:border-b-0 lg:p-10',
      )}
    >
      <SignalField />
      <div className="relative flex items-center gap-2.5">
        <Logo size={32} className="shrink-0" />
        <div>
          <p className="text-sm font-semibold">CIP 平台</p>
          <p className="text-[length:var(--text-meta)] text-muted-foreground">
            协同智能平台
          </p>
        </div>
      </div>

      <div className="relative mt-8 max-w-[460px] lg:my-auto lg:mt-0 lg:pt-11">
        <p className="text-[length:var(--text-meta)] font-medium tracking-wide text-primary">
          组织智能能力基座
        </p>
        <h1 className="mt-3.5 text-[length:var(--text-display)] font-semibold">
          一个入口，
          <br />
          连通组织的人、
          <br />
          权限与模型。
        </h1>
        <p className="mt-3.5 max-w-[420px] text-[length:var(--text-body)] leading-relaxed text-muted-foreground">
          统一账号、权限与模型服务。登录即进入按你职责生成的工作台。
        </p>
        <ul className="mt-8 hidden max-w-[380px] grid-cols-1 gap-3.5 lg:grid">
          {CAPABILITIES.map((capability) => (
            <li key={capability.title} className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                  'border border-border bg-card text-muted-foreground',
                )}
              >
                <capability.icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[length:var(--text-meta)] font-medium">
                  {capability.title}
                </p>
                <p className="mt-0.5 text-[length:var(--text-meta)] text-muted-foreground">
                  {capability.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative mt-8 hidden text-[length:var(--text-meta)] text-faint lg:mt-10 lg:block">
        © 2026 CIP Platform · 仅限组织内部账号
      </p>
    </aside>
  );
}
