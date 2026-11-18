import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ArtifactKind } from '../domain/artifact.entity';
import { Artifact } from '../domain/artifact.entity';
import {
  ARTIFACT_REPOSITORY,
  type ArtifactRepository,
} from '../domain/artifact.repository';

/** 合法产物类型；未知值回落澄清稿。 */
export function toArtifactKind(kind: string | undefined): ArtifactKind {
  return kind === 'breakdown' || kind === 'analysis' || kind === 'report'
    ? kind
    : 'clarify';
}

/** 发布产物的输入。 */
export interface PublishArtifactInput {
  /** 所属工单主键。 */
  ticketId: string;
  /** 产物类型。 */
  kind: ArtifactKind;
  /** 产物负载。 */
  payload: unknown;
  /** 生成该产物的派发主键。 */
  assignmentId?: string | null;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 产物用例：按工单与类型自动递增版本，确认或废弃。 */
@Injectable()
export class ArtifactService {
  constructor(
    @Inject(ARTIFACT_REPOSITORY)
    private readonly artifacts: ArtifactRepository,
  ) {}

  /** 发布新版本产物。 */
  async publish(input: PublishArtifactInput): Promise<Artifact> {
    const latest = await this.artifacts.findLatest(input.ticketId, input.kind);
    const artifact = Artifact.create({
      id: randomUUID(),
      ticketId: input.ticketId,
      kind: input.kind,
      version: (latest?.version ?? 0) + 1,
      payload: input.payload,
      assignmentId: input.assignmentId,
      now: input.now,
    });
    await this.artifacts.save(artifact);
    return artifact;
  }

  /** 确认产物。 */
  async confirm(id: string): Promise<Artifact> {
    const artifact = await this.load(id);
    artifact.confirm();
    await this.artifacts.save(artifact);
    return artifact;
  }

  /** 回滚到上一个版本：以上一版内容生成新版本，并废弃当前版本。 */
  async restoreLatest(
    ticketId: string,
    kind: ArtifactKind,
    now: Date = new Date(),
  ): Promise<Artifact> {
    const artifacts = (await this.artifacts.listByTicket(ticketId))
      .filter((artifact) => artifact.kind === kind)
      .sort((left, right) => right.version - left.version);
    if (artifacts.length < 2) throw new Error('没有可回滚的历史版本');
    const [latest, previous] = artifacts;
    const restored = await this.publish({
      ticketId,
      kind,
      payload: previous.payload,
      assignmentId: latest.assignmentId,
      now,
    });
    await this.supersede(latest.id);
    return restored;
  }

  /** 标记产物已被替代。 */
  async supersede(id: string): Promise<Artifact> {
    const artifact = await this.load(id);
    artifact.supersede();
    await this.artifacts.save(artifact);
    return artifact;
  }

  private async load(id: string): Promise<Artifact> {
    const artifact = await this.artifacts.findById(id);
    if (!artifact) throw new Error(`产物不存在：${id}`);
    return artifact;
  }
}
