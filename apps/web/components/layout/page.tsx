import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** 页面级布局组件：只提供 Header/Content/Footer 骨架槽位，不含业务语义。 */
function PageRoot({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

/** 页头：标题 24/600 + 描述 13 + 业务主操作（全页唯一主操作归此处）。 */
function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-7 pt-6 pb-5">
      <div className="min-w-0">
        <h1 className="text-[length:var(--text-title)] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {!!description && (
          <p className="mt-1.5 text-[length:var(--text-aux)] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {!!action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}

/** 内容区形态：default=页面左右 28；flush=表格满幅零内边距；constrained=760 列居中。 */
const CONTENT_CLASS = {
  default: 'overflow-y-auto px-7 pb-7',
  flush: 'pb-0',
  constrained: 'mx-auto w-full max-w-[760px] overflow-y-auto px-7 pb-7',
} as const;

/** 内容区：默认带页面左右 28 内边距；flush 供表格满幅；constrained 收拢为居中列。 */
function PageContent({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'flush' | 'constrained';
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-4',
        CONTENT_CLASS[variant],
      )}
    >
      {children}
    </div>
  );
}

/** 页面底部钉底动作条（长表单场景）；表格页不使用（表格自带页脚）。 */
function PageFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex justify-end gap-2 border-t px-7 py-3">
      {children}
    </div>
  );
}

/**
 * 页面骨架复合组件：聚合 Header、Content、Footer 三个槽位。
 */
export const Page = Object.assign(PageRoot, {
  Header: PageHeader,
  Content: PageContent,
  Footer: PageFooter,
});
