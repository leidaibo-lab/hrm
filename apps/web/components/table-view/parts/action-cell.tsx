'use client';

import { EllipsisIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { RowAction } from '../types';

/**
 * 行操作渲染：最多两个直接文本动作，其余进更多菜单；
 * 行条件由 when 决定；过渡态禁用。
 */
export function ActionCell<T>({
  row,
  actions,
  disabled,
  onRun,
}: {
  row: T;
  actions: RowAction<T>[];
  disabled?: boolean;
  onRun: (row: T, action: RowAction<T>) => void;
}) {
  const visible = actions.filter((action) => action.when?.(row) ?? true);
  if (visible.length === 0) return null;
  const direct = visible.slice(0, 2);
  const overflow = visible.slice(2);
  return (
    <div className="flex items-center justify-end gap-1">
      {direct.map((action) => {
        const enabled = action.enabled?.(row) ?? true;
        return (
          <Button
            key={action.label}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 text-[length:var(--text-meta)] text-muted-foreground',
              'hover:text-foreground',
            )}
            disabled={disabled || !enabled}
            onClick={(event) => {
              event.stopPropagation();
              onRun(row, action);
            }}
          >
            {action.danger ? (
              <span className="text-destructive">{action.label}</span>
            ) : (
              action.label
            )}
          </Button>
        );
      })}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label="更多操作"
              disabled={disabled}
              onClick={(event) => event.stopPropagation()}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            {overflow.map((action) => {
              const enabled = action.enabled?.(row) ?? true;
              return (
                <DropdownMenuItem
                  key={action.label}
                  disabled={disabled || !enabled}
                  className={action.danger ? 'text-destructive' : undefined}
                  onClick={() => onRun(row, action)}
                >
                  {action.icon && <action.icon className="size-4" />}
                  {action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
