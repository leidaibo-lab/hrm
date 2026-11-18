/** 关注状态不允许当前操作。 */
export class AttentionStateError extends Error {
  constructor(
    readonly code: 'closed' | 'expired',
    message: string,
  ) {
    super(message);
    this.name = 'AttentionStateError';
  }
}
