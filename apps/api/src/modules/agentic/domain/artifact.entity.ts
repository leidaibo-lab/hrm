/** 产物类型：澄清稿、拆解、分析、报告。 */
export type ArtifactKind = 'clarify' | 'breakdown' | 'analysis' | 'report';

/** 产物状态：草稿、已确认、已被替代。 */
export type ArtifactStatus = 'draft' | 'confirmed' | 'superseded';

/** 产物快照。 */
export interface ArtifactSnapshot {
  /** 产物主键。 */
  id: string;
  /** 所属工单主键。 */
  ticketId: string;
  /** 产物类型。 */
  kind: ArtifactKind;
  /** 版本号，按工单与类型递增。 */
  version: number;
  /** 产物负载。 */
  payload: unknown;
  /** 状态。 */
  status: ArtifactStatus;
  /** 生成该产物的派发主键。 */
  assignmentId: string | null;
  /** 创建时间。 */
  createdAt: Date;
}

/** 创建产物的输入。 */
export interface CreateArtifactInput {
  /** 产物主键。 */
  id: string;
  /** 所属工单主键。 */
  ticketId: string;
  /** 产物类型。 */
  kind: ArtifactKind;
  /** 版本号。 */
  version: number;
  /** 产物负载。 */
  payload: unknown;
  /** 生成该产物的派发主键。 */
  assignmentId?: string | null;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/** 产物聚合：版本只增不改，状态可确认或废弃。 */
export class Artifact {
  readonly #id: string;
  readonly #ticketId: string;
  readonly #kind: ArtifactKind;
  readonly #version: number;
  readonly #payload: unknown;
  #status: ArtifactStatus;
  readonly #assignmentId: string | null;
  readonly #createdAt: Date;

  private constructor(snapshot: ArtifactSnapshot) {
    this.#id = snapshot.id;
    this.#ticketId = snapshot.ticketId;
    this.#kind = snapshot.kind;
    this.#version = snapshot.version;
    this.#payload = snapshot.payload;
    this.#status = snapshot.status;
    this.#assignmentId = snapshot.assignmentId;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建草稿产物。 */
  static create(input: CreateArtifactInput): Artifact {
    if (input.version < 1) throw new Error('产物版本必须为正整数');
    if (input.payload === null || input.payload === undefined)
      throw new Error('产物负载不能为空');
    return new Artifact({
      id: input.id,
      ticketId: input.ticketId,
      kind: input.kind,
      version: input.version,
      payload: input.payload,
      status: 'draft',
      assignmentId: input.assignmentId ?? null,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: ArtifactSnapshot): Artifact {
    return new Artifact(snapshot);
  }

  /** 产物主键。 */
  get id(): string {
    return this.#id;
  }

  /** 所属工单主键。 */
  get ticketId(): string {
    return this.#ticketId;
  }

  /** 产物类型。 */
  get kind(): ArtifactKind {
    return this.#kind;
  }

  /** 版本号。 */
  get version(): number {
    return this.#version;
  }

  /** 产物负载。 */
  get payload(): unknown {
    return this.#payload;
  }

  /** 状态。 */
  get status(): ArtifactStatus {
    return this.#status;
  }

  /** 生成该产物的派发主键。 */
  get assignmentId(): string | null {
    return this.#assignmentId;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 确认产物。 */
  confirm(): void {
    if (this.#status === 'superseded')
      throw new Error('已被替代的产物不能确认');
    this.#status = 'confirmed';
  }

  /** 标记已被替代。 */
  supersede(): void {
    if (this.#status === 'superseded') return;
    this.#status = 'superseded';
  }

  /** 导出快照。 */
  toSnapshot(): ArtifactSnapshot {
    return {
      id: this.#id,
      ticketId: this.#ticketId,
      kind: this.#kind,
      version: this.#version,
      payload: this.#payload,
      status: this.#status,
      assignmentId: this.#assignmentId,
      createdAt: this.#createdAt,
    };
  }
}
