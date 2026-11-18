import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { InternalTokenGuard, Public } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { EffectService } from './application/effect.service';
import { InternalRuntimeService } from './application/internal-runtime.service';
import {
  type AppendReportRequest,
  appendReportSchema,
  type ReconcileEffectsRequest,
  reconcileEffectsSchema,
  type StartRunRequest,
  startRunSchema,
  type WriteArtifactRequest,
  writeArtifactSchema,
} from './dto/internal.dto';

/** 内部契约入口：执行器专用，共享令牌鉴权。 */
@ApiTags('internal')
@Controller('internal')
@Public()
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(
    private readonly runtime: InternalRuntimeService,
    private readonly effects: EffectService,
  ) {}

  /** 创建/恢复运行。 */
  @Post('runs')
  @HttpCode(200)
  @ApiBody({ schema: toOpenApiSchema(startRunSchema) })
  @ApiOperation({ summary: '内部：创建运行' })
  @ApiOkResponse({ description: '派发与执行器运行标识' })
  async startRun(
    @Body(new ZodValidationPipe(startRunSchema)) body: StartRunRequest,
  ): Promise<{ assignmentId: string; status: string }> {
    const result = await this.runtime.startRun(body);
    return { assignmentId: result.assignmentId, status: result.status };
  }

  /** 追加执行回报。 */
  @Post('reports')
  @HttpCode(200)
  @ApiBody({ schema: toOpenApiSchema(appendReportSchema) })
  @ApiOperation({ summary: '内部：追加回报' })
  @ApiOkResponse({ description: '回报主键' })
  async appendReport(
    @Body(new ZodValidationPipe(appendReportSchema)) body: AppendReportRequest,
  ): Promise<{ reportId: string }> {
    return this.runtime.appendReport(body);
  }

  /** 清理超时 pending 副作用；只允许人工触发。 */
  @Post('effects/reconcile')
  @HttpCode(200)
  @ApiBody({ schema: toOpenApiSchema(reconcileEffectsSchema) })
  @ApiOperation({ summary: '内部：清理超时副作用' })
  @ApiOkResponse({ description: '清理数量' })
  async reconcileEffects(
    @Body(new ZodValidationPipe(reconcileEffectsSchema))
    body: ReconcileEffectsRequest,
  ): Promise<{ expired: number }> {
    return this.effects.reconcilePending(new Date(), body.limit);
  }

  /** 写入执行产物。 */
  @Post('artifacts')
  @HttpCode(200)
  @ApiBody({ schema: toOpenApiSchema(writeArtifactSchema) })
  @ApiOperation({ summary: '内部：写入产物' })
  @ApiOkResponse({ description: '产物主键与版本' })
  async writeArtifact(
    @Body(new ZodValidationPipe(writeArtifactSchema))
    body: WriteArtifactRequest,
  ): Promise<{ artifactId: string; version: number }> {
    return this.runtime.writeArtifact(body);
  }
}
