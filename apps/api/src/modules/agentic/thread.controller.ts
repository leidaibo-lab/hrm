import { PERMISSION } from '@cip/shared';
import {
  BadRequestException,
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
import { ZodValidationPipe } from '../../pipeline/pipes';
import { ScopeAccessService } from './application/scope-access.service';
import { ThreadService } from './application/thread.service';
import {
  detectThreadConflicts,
  type ThreadDetailView,
  type ThreadView,
  toThreadView,
  toTicketView,
  toTriggerView,
} from './application/ticket-view.service';
import {
  type ListThreadsQuery,
  listThreadsQuerySchema,
} from './dto/thread.dto';
import {
  threadDetailViewSchema,
  threadListViewSchema,
} from './dto/thread-view.dto';

/** 线程入口：最近线程与按 key 的时间线。 */
@ApiTags('agentic')
@Controller('agentic/threads')
export class ThreadController {
  constructor(
    private readonly threads: ThreadService,
    private readonly scopes: ScopeAccessService,
  ) {}

  /** 列出最近线程。 */
  @Get()
  @RequirePermission(PERMISSION.ticket.read.code)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: '线程列表' })
  @ApiOkResponse({ schema: toOpenApiSchema(threadListViewSchema) })
  async list(
    @Query(new ZodValidationPipe(listThreadsQuerySchema))
    query: ListThreadsQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<{ items: ThreadView[] }> {
    const allowed = await this.scopes.allowedScopeKeys(user);
    const threads = await this.threads.list(query.limit, allowed ?? undefined);
    return { items: threads.map((thread) => toThreadView(thread)) };
  }

  /** 按 key 取线程详情；key 形如 lark:chat:thread。 */
  @Get(':key')
  @RequirePermission(PERMISSION.ticket.read.code)
  @ApiParam({ name: 'key', type: String })
  @ApiOperation({ summary: '线程详情' })
  @ApiOkResponse({ schema: toOpenApiSchema(threadDetailViewSchema) })
  async detail(
    @Param('key') key: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ThreadDetailView> {
    const decoded = this.decodeKey(key);
    const allowed = await this.scopes.allowedScopeKeys(user);
    const detail = await this.threads.detailByKey(
      decoded.sourceType,
      decoded.externalKey,
    );
    if (!detail) throw new NotFoundException('线程不存在');
    if (!this.scopes.isAllowed(detail.thread.scopeKey, allowed))
      throw new NotFoundException('线程不存在');
    return {
      thread: toThreadView(detail.thread),
      triggers: detail.triggers.map((trigger) => toTriggerView(trigger)),
      tickets: detail.tickets.map((ticket) => toTicketView(ticket)),
      conflicts: detectThreadConflicts(detail.triggers, detail.tickets),
    };
  }

  private decodeKey(key: string): { sourceType: string; externalKey: string } {
    let decoded = key;
    try {
      decoded = decodeURIComponent(key);
    } catch {
      throw new BadRequestException('线程 key 编码非法');
    }
    const separator = decoded.indexOf(':');
    if (separator <= 0 || separator === decoded.length - 1)
      throw new BadRequestException('线程 key 必须形如 sourceType:key');
    return {
      sourceType: decoded.slice(0, separator),
      externalKey: decoded.slice(separator + 1),
    };
  }
}
