import { PERMISSION } from '@cip/shared';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import {
  CurrentUser,
  RequirePermission,
  type SessionUser,
} from '../../pipeline/guards';
import { AuditRecordService } from './application/audit-record.service';
import {
  type AuditView,
  type TraceReplayView,
  toAuditView,
  toTraceReplay,
} from './application/audit-record-view.service';
import { ScopeAccessService } from './application/scope-access.service';
import {
  auditListResponseSchema,
  traceReplaySchema,
} from './dto/audit-view.dto';

/** 审计入口：动作与操作者过滤。 */
@ApiTags('agentic')
@Controller('agentic/audit')
export class AuditController {
  constructor(
    private readonly records: AuditRecordService,
    private readonly scopes: ScopeAccessService,
  ) {}

  /** 查询审计记录。 */
  @Get()
  @RequirePermission(PERMISSION.audit.read.code)
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'traceId', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: '审计记录' })
  @ApiOkResponse({ schema: toOpenApiSchema(auditListResponseSchema) })
  async list(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('traceId') traceId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @CurrentUser() user?: SessionUser,
  ): Promise<{ items: AuditView[] }> {
    const parsed = limit ? Number(limit) : 50;
    const parsedOffset = offset ? Number(offset) : 0;
    const items = await this.records.list({
      action,
      actorId,
      traceId,
      limit: Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 50,
      offset:
        Number.isFinite(parsedOffset) && parsedOffset > 0
          ? Math.floor(parsedOffset)
          : 0,
    });
    const allowed = user ? await this.scopes.allowedScopeKeys(user) : null;
    const visible = items.filter((item) =>
      this.scopes.isAllowed(toAuditScopeKey(item.detail), allowed),
    );
    return { items: visible.map((item) => toAuditView(item)) };
  }

  /** 按 traceId 回放：运行、步骤、产物与依据。 */
  @Get('traces/:traceId')
  @RequirePermission(PERMISSION.audit.read.code)
  @ApiParam({ name: 'traceId', type: String })
  @ApiOperation({ summary: '按 traceId 回放运行' })
  @ApiOkResponse({ schema: toOpenApiSchema(traceReplaySchema) })
  async replay(
    @Param('traceId') traceId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<TraceReplayView> {
    const records = await this.records.list({ traceId, limit: 200 });
    const allowed = await this.scopes.allowedScopeKeys(user);
    const visible = records.filter((record) =>
      this.scopes.isAllowed(toAuditScopeKey(record.detail), allowed),
    );
    if (visible.length === 0) throw new NotFoundException('追踪不存在');
    return toTraceReplay(traceId, visible);
  }
}

/** 读取审计详情中的 scopeKey；非对象或缺失返回 null。 */
function toAuditScopeKey(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object') return null;
  const scopeKey = (detail as { scopeKey?: unknown }).scopeKey;
  return typeof scopeKey === 'string' ? scopeKey : null;
}
