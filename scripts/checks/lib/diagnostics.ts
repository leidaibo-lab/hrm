/** 自动检查的确定性结果；人工项与违规分开。 */
export interface Diagnostic {
  rule: string;
  file: string;
  line: number;
  message: string;
  kind: 'violation' | 'review' | 'error';
}

/** 统一输出只含位置与原因，不回显源码或凭据。 */
export function formatDiagnostic(item: Diagnostic): string {
  return `${item.kind} ${item.rule} ${item.file}:${item.line} ${item.message}`;
}
