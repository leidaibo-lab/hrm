import type { OutboundTransport } from '../domain/outbound-transport.port';
import type { SourceType } from '../domain/source-adapter.port';

/** 出站传输注册表的 DI 令牌。 */
export const OUTBOUND_TRANSPORT_REGISTRY = Symbol(
  'OUTBOUND_TRANSPORT_REGISTRY',
);

/** 出站传输注册表：按来源类型索引。 */
export class OutboundTransportRegistry {
  readonly #transports = new Map<SourceType, OutboundTransport>();

  /** 注册传输；同类型重复注册报错。 */
  register(transport: OutboundTransport): void {
    if (this.#transports.has(transport.type))
      throw new Error(`出站传输重复注册：${transport.type}`);
    this.#transports.set(transport.type, transport);
  }

  /** 取传输；未注册报错。 */
  get(type: SourceType): OutboundTransport {
    const transport = this.#transports.get(type);
    if (!transport) throw new Error(`出站传输未注册：${type}`);
    return transport;
  }

  /** 是否已注册。 */
  has(type: SourceType): boolean {
    return this.#transports.has(type);
  }
}
