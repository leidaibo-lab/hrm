import type { SourceAdapter, SourceType } from '../domain/source-adapter.port';

/** 来源注册表的 DI 令牌。 */
export const SOURCE_REGISTRY = Symbol('SOURCE_REGISTRY');

/** 来源注册表：按类型索引适配器，未注册直接报错。 */
export class SourceRegistry {
  readonly #adapters = new Map<SourceType, SourceAdapter<unknown>>();

  /** 注册适配器；同类型重复注册直接报错。 */
  register(adapter: SourceAdapter<unknown>): void {
    if (this.#adapters.has(adapter.type))
      throw new Error(`来源适配器重复注册：${adapter.type}`);
    this.#adapters.set(adapter.type, adapter);
  }

  /** 取适配器；未注册报错。 */
  get(type: SourceType): SourceAdapter<unknown> {
    const adapter = this.#adapters.get(type);
    if (!adapter) throw new Error(`来源适配器未注册：${type}`);
    return adapter;
  }

  /** 是否已注册。 */
  has(type: SourceType): boolean {
    return this.#adapters.has(type);
  }
}
