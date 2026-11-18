import type { DefaultModelParams, ModelCapabilities } from '@cip/shared';

/**
 * 模型注册聚合：服务商下的一个上游模型 + 能力声明 + 默认参数。
 * 不变量：logicalKey 全局唯一（唯一约束兜底，唯一性校验在应用层调用前完成）；
 * 有计量历史的模型不可物理删除（仓储引用保护），停用为唯一下线手段（ADR-0015）。
 */
export class ProviderModel {
  readonly id: string;

  readonly #providerId: string;
  readonly #modelId: string;
  readonly #logicalKey: string;
  #displayName: string;
  #capabilities: ModelCapabilities;
  #defaultParams: DefaultModelParams | null;
  #enabled: boolean;

  private constructor(
    id: string,
    providerId: string,
    modelId: string,
    logicalKey: string,
    displayName: string,
    capabilities: ModelCapabilities,
    defaultParams: DefaultModelParams | null,
    enabled: boolean,
  ) {
    this.id = id;
    this.#providerId = providerId;
    this.#modelId = modelId;
    this.#logicalKey = logicalKey;
    this.#displayName = displayName;
    this.#capabilities = structuredClone(capabilities);
    this.#defaultParams =
      defaultParams === null ? null : structuredClone(defaultParams);
    this.#enabled = enabled;
  }

  /** 注册新模型：能力 schema 已由应用层解析为结构化值。 */
  static register(props: {
    providerId: string;
    modelId: string;
    logicalKey: string;
    displayName: string;
    capabilities: ModelCapabilities;
    defaultParams: DefaultModelParams | null;
  }): ProviderModel {
    return new ProviderModel(
      '',
      props.providerId,
      props.modelId,
      props.logicalKey,
      props.displayName,
      props.capabilities,
      props.defaultParams,
      true,
    );
  }

  /** 由持久化行重建（infrastructure mapper 专用入口）。 */
  static reconstitute(row: {
    id: string;
    providerId: string;
    modelId: string;
    logicalKey: string;
    displayName: string;
    capabilities: ModelCapabilities;
    defaultParams: DefaultModelParams | null;
    enabled: boolean;
  }): ProviderModel {
    const entity = new ProviderModel(
      row.id,
      row.providerId,
      row.modelId,
      row.logicalKey,
      row.displayName,
      row.capabilities,
      row.defaultParams,
      row.enabled,
    );
    return entity;
  }

  reconfigure(input: {
    displayName: string;
    capabilities: ModelCapabilities;
    defaultParams: DefaultModelParams | null;
  }): void {
    this.#displayName = input.displayName;
    this.#capabilities = structuredClone(input.capabilities);
    this.#defaultParams =
      input.defaultParams === null
        ? null
        : structuredClone(input.defaultParams);
  }

  enable(): void {
    this.#enabled = true;
  }

  disable(): void {
    this.#enabled = false;
  }

  get providerId(): string {
    return this.#providerId;
  }

  get modelId(): string {
    return this.#modelId;
  }

  get logicalKey(): string {
    return this.#logicalKey;
  }

  get displayName(): string {
    return this.#displayName;
  }

  get capabilities(): ModelCapabilities {
    return structuredClone(this.#capabilities);
  }

  get defaultParams(): DefaultModelParams | null {
    return this.#defaultParams === null
      ? null
      : structuredClone(this.#defaultParams);
  }

  get isEnabled(): boolean {
    return this.#enabled;
  }
}
