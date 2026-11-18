import { ServerIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

/** 供应商列表空态：图标 + 说明 + 主操作（经 URL 打开页头同款新建弹窗）。 */
export function ProvidersEmpty() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
      <span className="inline-grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <ServerIcon className="size-5" />
      </span>
      <div className="grid gap-1">
        <p className="text-[length:var(--text-body)] font-medium">
          还没有接入服务商
        </p>
        <p className="text-[length:var(--text-meta)] text-muted-foreground">
          新建后即可注册模型、配置能力与价格。
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="?create=1">新建服务商</Link>
      </Button>
    </div>
  );
}
