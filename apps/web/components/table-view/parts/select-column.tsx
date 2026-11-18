'use client';

import { Checkbox } from '@/components/ui/checkbox';

/** 表头三态 checkbox（overlay 顶部锚点）。 */
export function HeaderSelectCheckbox({
  checked,
  indeterminate,
  disabled,
  onToggle,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Checkbox
      aria-label="全选当前页"
      checked={indeterminate ? 'indeterminate' : checked}
      disabled={disabled}
      onCheckedChange={() => onToggle()}
    />
  );
}

/** 行 checkbox（overlay 中的悬浮控件）。 */
export function RowSelectCheckbox({
  id,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Checkbox
      aria-label={`选择行 ${id}`}
      checked={checked}
      disabled={disabled}
      onCheckedChange={() => onToggle(id)}
    />
  );
}
