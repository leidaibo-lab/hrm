import type { ModelCapabilities } from '@cip/shared';

/** 能力布尔位的中文标签（表格徽章与表单勾选共用）。 */
export const CAPABILITY_LABELS = {
  toolCall: '工具',
  imageInput: '视觉',
  audioInput: '音频',
  structuredOutput: '结构化',
  reasoning: '推理',
  embedding: '嵌入',
  streaming: '流式',
} as const;

/** 能力开关键（布尔位）。 */
export type CapabilityToggleKey = keyof typeof CAPABILITY_LABELS;

/** 能力徽章文案：仅列出为 true 的布尔位。 */
export function capabilityBadges(capabilities: ModelCapabilities): string {
  const enabled = Object.entries(capabilities)
    .filter(([, value]) => typeof value === 'boolean' && value)
    .map(([key]) => CAPABILITY_LABELS[key as CapabilityToggleKey] ?? key);
  return enabled.length > 0 ? enabled.join(' · ') : '—';
}
