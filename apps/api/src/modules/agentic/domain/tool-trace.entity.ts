/** 一次工具调用的可回放轨迹：参数与结果均已脱敏、截断。 */
export interface ToolCallTrace {
  /** 调用标识；执行器未提供时由读取方按出现顺序生成。 */
  id?: string;
  /** 工具标识。 */
  name: string;
  /** 入参；缺失表示执行器未提供。 */
  input?: unknown;
  /** 结果；缺失表示执行器未提供。 */
  output?: unknown;
}
