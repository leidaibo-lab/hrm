import type { SourceType } from './source-adapter.port';

/** 永久失败：地址或凭据不可恢复，重试无意义。 */
export class PermanentOutboundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentOutboundError';
  }
}

/** 出站发送输入：地址与消息负载都由来源适配器解释。 */
export interface OutboundSendInput {
  /** 地址负载。 */
  address: unknown;
  /** 消息负载。 */
  payload: unknown;
}

/** 出站传输端口：每个来源实现一个，只负责把消息发出去。 */
export interface OutboundTransport {
  /** 来源类型。 */
  readonly type: SourceType;
  /** 发送一条消息；永久失败抛 PermanentOutboundError。 */
  send(input: OutboundSendInput): Promise<void>;
}
