import type { OptionTone, SemanticOption } from '../types';

/**
 * 语义选项工厂：`option.success('启用')` 返回 `{ label, tone, icon? }`；
 * 渲染层根据 tone 适配状态点、chip 或筛选选择，业务不允许传 Tailwind class。
 * 所有状态列与筛选器共享同一份 label/tone/icon。
 */
function make(tone: OptionTone) {
  return (label: string, icon?: SemanticOption['icon']): SemanticOption => ({
    label,
    tone,
    ...(icon ? { icon } : {}),
  });
}

/** 语义选项工厂命名空间：success/neutral/warning/danger。 */
export const option = {
  success: make('success'),
  neutral: make('neutral'),
  warning: make('warning'),
  danger: make('danger'),
};
