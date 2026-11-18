'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * 行详情抽屉（peek）：右侧滑入，遮罩 / Esc / 关闭按钮退出。
 * 由 TableView 的 `renderRowDetail` 插槽挂载，`row: null` 为关闭态（保住关闭动画）。
 */
export function RowDetailDrawer<T>({
  row,
  onClose,
  width = 520,
  title = '详情',
  children,
}: {
  row: T | null;
  onClose: () => void;
  width?: number;
  title?: string;
  children: (row: T) => React.ReactNode;
}) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto"
        style={{ maxWidth: width }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        {row !== null && children(row)}
      </SheetContent>
    </Sheet>
  );
}
