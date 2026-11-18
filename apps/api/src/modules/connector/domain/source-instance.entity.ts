import type { SourceType } from './source-adapter.port';

/** 来源实例快照。 */
export interface SourceInstanceSnapshot {
  /** 实例主键。 */
  id: string;
  /** 来源类型。 */
  sourceType: SourceType;
  /** 实例名称，同一类型内唯一。 */
  name: string;
  /** 配置负载，结构由适配器 schema 约束。 */
  config: unknown;
  /** 机器人自身标识，用于过滤自身消息。 */
  botId: string | null;
  /** 是否启用。 */
  enabled: boolean;
  /** 创建时间。 */
  createdAt: Date;
  /** 最近更新时间。 */
  updatedAt: Date;
}

/** 创建来源实例的输入。 */
export interface CreateSourceInstanceInput {
  /** 实例主键。 */
  id: string;
  /** 来源类型。 */
  sourceType: SourceType;
  /** 实例名称。 */
  name: string;
  /** 配置负载。 */
  config: unknown;
  /** 机器人标识。 */
  botId?: string | null;
  /** 是否启用。 */
  enabled?: boolean;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/** 来源实例聚合：一份可启停的源配置。 */
export class SourceInstance {
  readonly #id: string;
  readonly #sourceType: SourceType;
  #name: string;
  #config: unknown;
  #botId: string | null;
  #enabled: boolean;
  readonly #createdAt: Date;
  #updatedAt: Date;

  private constructor(snapshot: SourceInstanceSnapshot) {
    this.#id = snapshot.id;
    this.#sourceType = snapshot.sourceType;
    this.#name = snapshot.name;
    this.#config = snapshot.config;
    this.#botId = snapshot.botId;
    this.#enabled = snapshot.enabled;
    this.#createdAt = snapshot.createdAt;
    this.#updatedAt = snapshot.updatedAt;
  }

  /** 创建来源实例。 */
  static create(input: CreateSourceInstanceInput): SourceInstance {
    if (!input.name.trim()) throw new Error('来源实例名称不能为空');
    if (input.config === null || input.config === undefined)
      throw new Error('来源配置不能为空');
    const now = input.now ?? new Date();
    return new SourceInstance({
      id: input.id,
      sourceType: input.sourceType,
      name: input.name,
      config: input.config,
      botId: input.botId ?? null,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: SourceInstanceSnapshot): SourceInstance {
    return new SourceInstance(snapshot);
  }

  /** 实例主键。 */
  get id(): string {
    return this.#id;
  }

  /** 来源类型。 */
  get sourceType(): SourceType {
    return this.#sourceType;
  }

  /** 实例名称。 */
  get name(): string {
    return this.#name;
  }

  /** 配置负载。 */
  get config(): unknown {
    return this.#config;
  }

  /** 机器人标识。 */
  get botId(): string | null {
    return this.#botId;
  }

  /** 是否启用。 */
  get isEnabled(): boolean {
    return this.#enabled;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 最近更新时间。 */
  get updatedAt(): Date {
    return this.#updatedAt;
  }

  /** 修改名称、配置或机器人标识。 */
  reconfigure(
    input: { name?: string; config?: unknown; botId?: string | null },
    at: Date,
  ): void {
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('来源实例名称不能为空');
      this.#name = name;
    }
    if (input.config !== undefined) {
      if (input.config === null) throw new Error('来源配置不能为空');
      this.#config = input.config;
    }
    if (input.botId !== undefined) this.#botId = input.botId;
    this.#updatedAt = at;
  }

  /** 启用。 */
  enable(at: Date): void {
    if (this.#enabled) return;
    this.#enabled = true;
    this.#updatedAt = at;
  }

  /** 停用。 */
  disable(at: Date): void {
    if (!this.#enabled) return;
    this.#enabled = false;
    this.#updatedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): SourceInstanceSnapshot {
    return {
      id: this.#id,
      sourceType: this.#sourceType,
      name: this.#name,
      config: this.#config,
      botId: this.#botId,
      enabled: this.#enabled,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
