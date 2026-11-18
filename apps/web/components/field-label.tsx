import type { ComponentProps } from 'react';
import { FieldLabel as UiFieldLabel } from '@/components/ui/field';

/**
 * 表单字段标签业务封装：`required` 为 true 时在标签后追加必填标记 *（aria-hidden）。
 * vendor 的 ui/field 保持上游原样，业务定制只在此层叠加。
 */
export function FieldLabel({
  required = false,
  children,
  ...props
}: ComponentProps<typeof UiFieldLabel> & { required?: boolean }) {
  return (
    <UiFieldLabel {...props}>
      {children}
      {required && (
        <span aria-hidden className="text-destructive">
          *
        </span>
      )}
    </UiFieldLabel>
  );
}
