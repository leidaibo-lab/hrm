'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PAGE_SIZE_OPTIONS } from '../model/normalize-query';

/** 页码组条目：ellipsis 附稳定 id（规避数组下标键）。 */
type PageItem = { id: string; value: number | '…' };

/** 页码组：≤7 页全显，超则 1/max/邻页 + 省略号。 */
function pageItems(page: number, pageCount: number): PageItem[] {
  const withId = (value: number | '…', suffix: string): PageItem => ({
    id: `${value}-${suffix}`,
    value,
  });
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) =>
      withId(index + 1, 'page'),
    );
  }
  const items: PageItem[] = [withId(1, 'page')];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push(withId('…', 'head'));
  for (let index = start; index <= end; index += 1) {
    items.push(withId(index, 'page'));
  }
  if (end < pageCount - 1) items.push(withId('…', 'tail'));
  items.push(withId(pageCount, 'page'));
  return items;
}

/**
 * 分页底栏：左侧固定文案；右侧每页数量、前后页与桌面页码组；
 * 窄屏单行且不重复页码组；是滚动区的兄弟区域，不随横向滚动。
 */
export function TableFooter({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}) {
  const items = pageItems(page, pageCount);
  return (
    <div
      className={cn(
        'flex h-11 shrink-0 items-center justify-between gap-1 border-t border-border',
        className,
      )}
    >
      <p className="whitespace-nowrap text-[length:var(--text-meta)] text-muted-foreground">
        第 {page} / {pageCount} 页，共 {total} 条数据
      </p>
      <div className="flex min-w-0 items-center gap-1">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-[72px] sm:w-[92px] text-[length:var(--text-meta)]"
            aria-label="每页条数"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} 条/页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <div className="hidden items-center gap-0.5 md:flex">
          {items.map((item) =>
            item.value === '…' ? (
              <span
                key={item.id}
                className="px-1 text-[length:var(--text-meta)] text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={item.id}
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 text-[length:var(--text-meta)]',
                  item.value === page &&
                    'bg-foreground text-background hover:bg-foreground',
                )}
                aria-current={item.value === page ? 'page' : undefined}
                onClick={() => {
                  if (item.value !== '…') onPageChange(item.value);
                }}
              >
                {item.value}
              </Button>
            ),
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="下一页"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
