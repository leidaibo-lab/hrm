import { PERMISSION } from '@cip/shared';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import {
  CurrentUser,
  RequirePermission,
  type SessionUser,
} from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import {
  ArtifactService,
  toArtifactKind,
} from './application/artifact.service';
import { GateService } from './application/gate.service';
import { ScopeAccessService } from './application/scope-access.service';
import { TicketService } from './application/ticket.service';
import {
  type TicketDetailView,
  type TicketView,
  toArtifactView,
  toAssignmentView,
  toAttentionView,
  toMandateView,
  toTicketView,
} from './application/ticket-view.service';
import type { TicketTimeline } from './application/timeline.service';
import { TimelineService } from './application/timeline.service';
import {
  type EndTicketRequest,
  endTicketSchema,
  type ListTicketsQuery,
  listTicketsQuerySchema,
} from './dto/ticket.dto';
import {
  ticketDetailResponseSchema,
  ticketListResponseSchema,
  ticketTimelineSchema,
  ticketViewSchema,
} from './dto/ticket-view.dto';

/** 工单入口：列表、详情、结束与重新打开。 */
@ApiTags('agentic')
@Controller('agentic/tickets')
export class TicketController {
  constructor(
    private readonly tickets: TicketService,
    private readonly timeline: TimelineService,
    private readonly artifacts: ArtifactService,
    private readonly gate: GateService,
    private readonly scopes: ScopeAccessService,
  ) {}

  /** 列出工单。 */
  @Get()
  @RequirePermission(PERMISSION.ticket.read.code)
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'ended'] })
  @ApiQuery({ name: 'scopeKey', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: '工单列表' })
  @ApiOkResponse({ schema: toOpenApiSchema(ticketListResponseSchema) })
  async list(
    @Query(new ZodValidationPipe(listTicketsQuerySchema))
    query: ListTicketsQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<{ items: TicketView[] }> {
    const allowed = await this.scopes.allowedScopeKeys(user);
    const rows = await this.tickets.listWithWaiting(
      query,
      allowed ?? undefined,
    );
    return {
      items: rows.map((row) => toTicketView(row.ticket, row.attentions)),
    };
  }

  /** 工单轨迹：事件、结论、产物、派发按时间合并。 */
  @Get(':id/timeline')
  @RequirePermission(PERMISSION.audit.read.code)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '工单轨迹' })
  @ApiQuery({ name: 'at', required: false, type: String })
  @ApiOkResponse({ schema: toOpenApiSchema(ticketTimelineSchema) })
  async timelineForTicket(
    @Param('id') id: string,
    @Query('at') at?: string,
  ): Promise<TicketTimeline> {
    let until: Date | undefined;
    if (at) {
      until = new Date(at);
      if (Number.isNaN(until.getTime()))
        throw new BadRequestException('at 不是合法时间');
    }
    const timeline = await this.timeline.forTicket(id, until);
    if (!timeline) throw new NotFoundException('工单不存在');
    return timeline;
  }

  /** 工单详情。 */
  @Get(':id')
  @RequirePermission(PERMISSION.ticket.read.code)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '工单详情' })
  @ApiOkResponse({ schema: toOpenApiSchema(ticketDetailResponseSchema) })
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<TicketDetailView> {
    const allowed = await this.scopes.allowedScopeKeys(user);
    const detail = await this.tickets.detail(id);
    if (!detail) throw new NotFoundException('工单不存在');
    if (!this.scopes.isAllowed(detail.ticket.scopeKey, allowed))
      throw new NotFoundException('工单不存在');
    return {
      ticket: toTicketView(detail.ticket, detail.attentions),
      ...(detail.mandate ? { mandate: toMandateView(detail.mandate) } : {}),
      artifacts: detail.artifacts.map((artifact) => toArtifactView(artifact)),
      attentions: detail.attentions.map((attention) =>
        toAttentionView(attention),
      ),
      assignments: detail.assignments.map((assignment) =>
        toAssignmentView(assignment),
      ),
    };
  }

  /** 回滚澄清稿到上一版本。 */
  @Post(':id/artifacts/restore')
  @HttpCode(200)
  @RequirePermission(PERMISSION.artifact.write.code)
  @Audit('artifact.restore')
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'kind', required: false, type: String })
  @ApiOperation({ summary: '回滚产物到上一版本' })
  @ApiOkResponse({ description: '新版本产物' })
  async restoreArtifact(
    @Param('id') id: string,
    @Query('kind') kind?: string,
  ): Promise<{ id: string; version: number; status: string }> {
    const detail = await this.tickets.detail(id);
    if (!detail) throw new NotFoundException('工单不存在');
    if (!detail.ticket.isOpen)
      throw new ConflictException('已结束工单不能回滚产物');
    const artifact = await this.artifacts.restoreLatest(
      id,
      toArtifactKind(kind),
    );
    return {
      id: artifact.id,
      version: artifact.version,
      status: artifact.status,
    };
  }

  /** 撤销字段回填：以上一版本内容追加新版本并写回。 */
  @Post(':id/writeback/revoke')
  @HttpCode(200)
  @RequirePermission(
    PERMISSION.ticket.decide.code,
    PERMISSION.artifact.write.code,
  )
  @Audit('artifact.revoke')
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['clarify', 'breakdown', 'analysis', 'report'],
  })
  @ApiOperation({ summary: '撤销上一版本字段回填' })
  @ApiOkResponse({ description: '撤销后追加的产物与写回字段' })
  async revokeWriteback(
    @Param('id') id: string,
    @Query('kind') kind?: string,
  ): Promise<{
    id: string;
    version: number;
    status: string;
    fields: Record<string, unknown>;
  }> {
    try {
      const result = await this.gate.revokeWriteback(id, toArtifactKind(kind));
      return {
        id: result.artifact.id,
        version: result.artifact.version,
        status: result.artifact.status,
        fields: result.fields,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '撤销回填失败';
      if (message.includes('不存在')) throw new NotFoundException(message);
      throw new ConflictException(message);
    }
  }

  /** 结束工单。 */
  @Post(':id/end')
  @HttpCode(200)
  @RequirePermission(PERMISSION.ticket.updateStatus.code)
  @Audit('ticket.end')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: toOpenApiSchema(endTicketSchema) })
  @ApiOperation({ summary: '结束工单' })
  @ApiOkResponse({ schema: toOpenApiSchema(ticketViewSchema) })
  async end(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(endTicketSchema)) body: EndTicketRequest,
  ): Promise<TicketView> {
    const ticket = await this.tickets.end(id, body.reason);
    return toTicketView(ticket);
  }

  /** 重新打开工单。 */
  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermission(PERMISSION.ticket.updateStatus.code)
  @Audit('ticket.reopen')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '重新打开工单' })
  @ApiOkResponse({ schema: toOpenApiSchema(ticketViewSchema) })
  async reopen(@Param('id') id: string): Promise<TicketView> {
    const ticket = await this.tickets.reopen(id);
    return toTicketView(ticket);
  }
}
