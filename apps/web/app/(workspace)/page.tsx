import type { NavigationNodeDto } from '@cip/shared';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { connection } from 'next/server';
import { NavIcon } from '@/components/nav-icon';
import { probeHealth } from '@/lib/health';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';

/** 工作台：会话 + 健康探针可派生的真实信息，RSC-first；无数据源的分区给空态。 */
export const instant = false;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 入口的一句话说明（来自产品定位，不参与权限判定）。 */
const ENTRY_HINTS: Record<string, string> = {
  'admin.users': '账号启停与角色绑定',
  'admin.roles': '维护权限授予关系',
  'admin.menus': '导航文案与显隐',
  'admin.permission-points': '代码目录自动收集',
  'admin.ai-providers': '供应商、模型与限流',
  'admin.ai-usages': '调用与成本明细',
};

/** 仅供展示的入口摘要：导航 leaf（有 path 才算入口）。 */
type QuickEntry = {
  code: string;
  title: string;
  path: string;
  icon: string | null;
};

/** 导航树扁平化为可访问入口；域自身无子项时以域为入口。 */
function collectEntries(navigation: NavigationNodeDto[]): QuickEntry[] {
  return navigation.flatMap((node) => {
    const items = node.children.length > 0 ? node.children : [node];
    return items
      .filter((item) => item.path !== null)
      .map((item) => ({
        code: item.code,
        title: item.title,
        path: item.path ?? '/',
        icon: item.icon,
      }));
  });
}

/** 探针结果与检查时间；探针本身有 5s 超时，异常按不可达处理。 */
async function readHealth(): Promise<{ ok: boolean; checkedAt: string }> {
  await connection();
  const checkedAt = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  try {
    return { ok: await probeHealth(), checkedAt };
  } catch {
    return { ok: false, checkedAt };
  }
}

function formatDate(date: Date): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 · 周${WEEKDAYS[date.getDay()]}`;
}

/** 分区标题：左侧标题 + 说明，右侧可选入口。 */
function SectionHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-[length:var(--text-section)] font-semibold">
        {title}
      </h2>
      {meta && (
        <span className="text-[length:var(--text-meta)] text-muted-foreground">
          {meta}
        </span>
      )}
      {action && (
        <Link
          href={action.href}
          className="ml-auto text-[length:var(--text-meta)] text-primary transition-control hover:opacity-80"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** 统计项：上下 hairline 的扁平数据带，无卡片、无阴影。 */
function StatsBand({
  stats,
}: {
  stats: {
    label: string;
    value: string | number;
    note: string;
    danger?: boolean;
  }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-y-4 border-y border-border sm:grid-cols-4 sm:gap-y-0">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn(
            'py-3.5',
            index > 0 && 'sm:border-l sm:border-border sm:pl-4',
            index < stats.length - 1 && 'sm:pr-4',
          )}
        >
          <dt className="text-[length:var(--text-meta)] text-muted-foreground">
            {stat.label}
          </dt>
          <dd
            className={cn(
              'mt-1.5 text-[length:var(--text-figure)] font-semibold tracking-tight tabular-nums',
              stat.danger && 'text-destructive',
            )}
          >
            {stat.value}
          </dd>
          <dd className="mt-1.5 text-[length:var(--text-meta)] text-muted-foreground">
            {stat.note}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 右栏分区：hairline 分隔的单列，分区之间不叠卡片。 */
function RailSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-4 last:border-b-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[length:var(--text-body)] font-semibold">
          {title}
        </h2>
        {meta && (
          <span className="ml-auto text-[length:var(--text-meta)] text-muted-foreground">
            {meta}
          </span>
        )}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/** 信号行：名称 + 右侧 mono 值。 */
function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[length:var(--text-body)] text-muted-foreground">
      {label}
      <span className="ml-auto font-mono text-[length:var(--text-meta)] text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

export default async function WorkspacePage() {
  await connection();
  const session = await getSession();
  const health = await readHealth();
  const leaves = collectEntries(session.navigation);
  // 工作台自身不在快捷入口里重复出现
  const quickEntries = leaves.filter((entry) => entry.path !== '/');
  const domains = session.navigation.map((node) => {
    const items = node.children.length > 0 ? node.children : [node];
    return {
      code: node.code,
      title: node.title,
      count: items.filter((item) => item.path !== null).length,
    };
  });
  const hasAllPermissions = session.permissions.includes('*');
  const nextStep =
    quickEntries.find((entry) => entry.code === 'admin.users') ??
    quickEntries[0];

  const stats = [
    {
      label: '可访问页面',
      value: leaves.length,
      note: `覆盖 ${domains.length} 个导航域`,
    },
    {
      label: '快捷入口',
      value: quickEntries.length,
      note: '按你的权限生成',
    },
    {
      label: '授权范围',
      value: hasAllPermissions ? '全部' : session.permissions.length,
      note: hasAllPermissions ? '超级管理员' : '按角色分配',
    },
    {
      label: '服务状态',
      value: health.ok ? '正常' : '异常',
      note: `最近检查 ${health.checkedAt}`,
      danger: !health.ok,
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1360px] content-start gap-6 px-6 py-6">
      <div className="flex items-end justify-between gap-5">
        <div>
          <h1 className="text-[length:var(--text-title)] font-semibold">
            工作台
          </h1>
          <p className="mt-1.5 text-[length:var(--text-body)] text-muted-foreground">
            {formatDate(new Date())}
          </p>
        </div>
        <span className="hidden text-[length:var(--text-meta)] text-faint sm:block">
          最近检查 {health.checkedAt}
        </span>
      </div>

      <div
        role="note"
        aria-label="按 ⌘K 打开全局搜索"
        className={cn(
          'flex h-[52px] items-center gap-3 rounded-xl border border-border bg-card px-3.5',
          'text-[length:var(--text-body)] text-muted-foreground',
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="size-2 rounded-full bg-primary" />
        </span>
        搜索页面、成员，或执行操作
        <kbd
          className={cn(
            'ml-auto rounded-sm border border-border bg-secondary px-1.5 py-0.5',
            'font-mono text-[length:var(--text-meta)]',
          )}
        >
          ⌘K
        </kbd>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <StatsBand stats={stats} />

          <section className="mt-6">
            <SectionHead title="快捷入口" meta="按你的权限生成" />
            {quickEntries.length === 0 && (
              <p className="mt-2 border-t border-border py-6 text-[length:var(--text-body)] text-muted-foreground">
                当前账号暂无可访问的入口，请联系平台管理员开通。
              </p>
            )}
            <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
              {quickEntries.map((entry) => (
                <Link
                  key={entry.code}
                  href={entry.path}
                  className={cn(
                    'flex items-start gap-3 border-b border-border py-3 pr-2',
                    'transition-control hover:bg-secondary',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                      'bg-secondary text-muted-foreground',
                    )}
                  >
                    <NavIcon name={entry.icon ?? ''} className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[length:var(--text-body)] font-medium">
                      {entry.title}
                    </p>
                    <p className="mt-0.5 truncate text-[length:var(--text-meta)] text-muted-foreground">
                      {ENTRY_HINTS[entry.code] ?? `进入${entry.title}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <SectionHead title="最近活动" meta="过去 24 小时" />
            <div className="mt-2 flex flex-col items-center gap-2 border-t border-border py-8 text-center">
              <Activity className="size-5 text-faint" aria-hidden />
              <p className="text-[length:var(--text-body)] text-muted-foreground">
                暂无活动记录
              </p>
              {nextStep && (
                <Link
                  href={nextStep.path}
                  className={cn(
                    'text-[length:var(--text-body)] text-primary transition-control',
                    'hover:underline hover:underline-offset-4',
                  )}
                >
                  去{nextStep.title} →
                </Link>
              )}
            </div>
          </section>
        </div>

        <aside className="lg:border-t lg:border-border">
          <RailSection title="系统状态" meta={`最近检查 ${health.checkedAt}`}>
            <div className="flex items-center gap-2.5 py-1.5 text-[length:var(--text-body)] text-muted-foreground">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  health.ok ? 'bg-success' : 'bg-destructive',
                )}
              />
              平台 API
              <span className="ml-auto font-mono text-[length:var(--text-meta)] text-muted-foreground">
                {health.ok ? '正常' : '不可达'}
              </span>
            </div>
          </RailSection>

          <RailSection title="访问范围" meta={`共 ${leaves.length} 个页面`}>
            {domains.map((domain) => (
              <RailRow
                key={domain.code}
                label={domain.title}
                value={`${domain.count} 个页面`}
              />
            ))}
          </RailSection>

          <RailSection
            title="当前会话"
            meta={hasAllPermissions ? '全量授权' : '按角色授权'}
          >
            <RailRow label="用户" value={session.user.name} />
            <RailRow label="账号" value={session.user.username} />
            <RailRow
              label="权限"
              value={
                hasAllPermissions
                  ? '全部权限'
                  : `${session.permissions.length} 项`
              }
            />
          </RailSection>
        </aside>
      </div>
    </div>
  );
}
