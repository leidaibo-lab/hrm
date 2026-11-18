/** connector 领域错误基类。 */
export class ConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** 来源名称冲突：同一类型下名称唯一。 */
export class SourceNameConflictError extends ConnectorError {
  constructor(name: string) {
    super(`来源名称已存在：${name}`);
  }
}
