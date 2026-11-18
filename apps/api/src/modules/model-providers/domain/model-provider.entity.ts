/**
 * 供应商聚合：OpenAI 兼容接入点 + 凭据密文 + 限流参数。
 * 不变量：slug 创建后不可变（网关路由标识与外部引用锚点）；
 * 停用（enabled=false）是唯一的下线手段，物理删除由仓储层引用保护兜底（ADR-0015）。
 */
export class ModelProvider {
  readonly id: string;

  readonly #slug: string;
  #name: string;
  #baseUrl: string;
  #apiKeyCipher: string;
  #timeoutMs: number | null;
  #rateLimitPerMinute: number | null;
  #maxConcurrent: number | null;
  #enabled: boolean;

  private constructor(
    id: string,
    slug: string,
    name: string,
    baseUrl: string,
    apiKeyCipher: string,
    timeoutMs: number | null,
    rateLimitPerMinute: number | null,
    maxConcurrent: number | null,
    enabled: boolean,
  ) {
    this.id = id;
    this.#slug = slug;
    this.#name = name;
    this.#baseUrl = baseUrl;
    this.#apiKeyCipher = apiKeyCipher;
    this.#timeoutMs = timeoutMs;
    this.#rateLimitPerMinute = rateLimitPerMinute;
    this.#maxConcurrent = maxConcurrent;
    this.#enabled = enabled;
  }

  /** 新建供应商：凭据密文由应用层经 crypto 适配器产出后传入。 */
  static register(props: {
    slug: string;
    name: string;
    baseUrl: string;
    apiKeyCipher: string;
    timeoutMs: number | null;
    rateLimitPerMinute: number | null;
    maxConcurrent: number | null;
  }): ModelProvider {
    return new ModelProvider(
      '',
      props.slug,
      props.name,
      props.baseUrl,
      props.apiKeyCipher,
      props.timeoutMs,
      props.rateLimitPerMinute,
      props.maxConcurrent,
      true,
    );
  }

  /** 由持久化行重建（infrastructure mapper 专用入口）。 */
  static reconstitute(row: {
    id: string;
    slug: string;
    name: string;
    baseUrl: string;
    apiKeyCipher: string;
    timeoutMs: number | null;
    rateLimitPerMinute: number | null;
    maxConcurrent: number | null;
    enabled: boolean;
  }): ModelProvider {
    const entity = new ModelProvider(
      row.id,
      row.slug,
      row.name,
      row.baseUrl,
      row.apiKeyCipher,
      row.timeoutMs,
      row.rateLimitPerMinute,
      row.maxConcurrent,
      row.enabled,
    );
    return entity;
  }

  /** 更新接入与限流配置；slug 不在可变集合内。 */
  reconfigure(input: {
    name: string;
    baseUrl: string;
    timeoutMs: number | null;
    rateLimitPerMinute: number | null;
    maxConcurrent: number | null;
  }): void {
    this.#name = input.name;
    this.#baseUrl = input.baseUrl;
    this.#timeoutMs = input.timeoutMs;
    this.#rateLimitPerMinute = input.rateLimitPerMinute;
    this.#maxConcurrent = input.maxConcurrent;
  }

  /** 凭据轮换：仅替换密文，明文不落任何字段。 */
  rotateApiKey(apiKeyCipher: string): void {
    this.#apiKeyCipher = apiKeyCipher;
  }

  enable(): void {
    this.#enabled = true;
  }

  disable(): void {
    this.#enabled = false;
  }

  get slug(): string {
    return this.#slug;
  }

  get name(): string {
    return this.#name;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  get apiKeyCipher(): string {
    return this.#apiKeyCipher;
  }

  get timeoutMs(): number | null {
    return this.#timeoutMs;
  }

  get rateLimitPerMinute(): number | null {
    return this.#rateLimitPerMinute;
  }

  get maxConcurrent(): number | null {
    return this.#maxConcurrent;
  }

  get isEnabled(): boolean {
    return this.#enabled;
  }
}
