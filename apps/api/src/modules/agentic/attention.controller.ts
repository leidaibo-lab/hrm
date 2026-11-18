import { PERMISSION } from '@cip/shared';
import {
  Body,
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
import { z } from 'zod';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import {
  CurrentUser,
  RequirePermission,
  type SessionUser,
} from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { AttentionService } from './application/attention.service';
import { GateService } from './application/gate.service';
import { ScopeAccessService } from './application/scope-access.service';
import {
  type AttentionView,
  toAttentionView,
} from './application/ticket-view.service';
import {
  type AnswerAttentionRequest,
  answerAttentionSchema,
} from './dto/ticket.dto';
import { attentionViewSchema } from './dto/ticket-view.dto';

/** 关注入口：待答列表与回答。 */
@ApiTags('agentic')
@Controller('agentic/attention')
export class AttentionController {
  constructor(
    private readonly attentions: AttentionService,
    private readonly gate: GateService,
    private readonly scopes: ScopeAccessService,
  ) {}

  /** 列出待答关注。 */
  @Get()
  @RequirePermission(PERMISSION.ticket.read.code)
  @ApiQuery({ name: 'kind', required: false, type: String })
  @ApiOperation({ summary: '待答关注列表' })
  @ApiOkResponse({
    schema: toOpenApiSchema(z.object({ items: z.array(attentionViewSchema) })),
  })
  async list(
    @Query('kind') kind: string | undefined,
    @CurrentUser() user: SessionUser,
  ): Promise<{ items: AttentionView[] }> {
    const attentions = await this.attentions.listOpen(100);
    const filtered = kind
      ? attentions.filter((attention) => attention.kind === kind)
      : attentions;
    const allowed = await this.scopes.allowedScopeKeys(user);
    const visible: AttentionView[] = [];
    for (const attention of filtered.slice(0, 50)) {
      if (await this.scopes.canAccessTicket(attention.ticketId, allowed))
        visible.push(toAttentionView(attention));
    }
    return { items: visible };
  }

  /** 回答关注。 */
  @Post(':id/answer')
  @HttpCode(200)
  @RequirePermission(PERMISSION.ticket.decide.code)
  @Audit('attention.answer')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: toOpenApiSchema(answerAttentionSchema) })
  @ApiOperation({ summary: '回答关注' })
  @ApiOkResponse({ schema: toOpenApiSchema(attentionViewSchema) })
  async answer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(answerAttentionSchema))
    body: AnswerAttentionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AttentionView> {
    const target = await this.attentions.findById(id);
    if (!target) throw new NotFoundException('关注不存在');
    const allowed = await this.scopes.allowedScopeKeys(user);
    if (!(await this.scopes.canAccessTicket(target.ticketId, allowed)))
      throw new NotFoundException('关注不存在');
    const attention = await this.gate.answerAttention(
      id,
      body.answer,
      body.decision,
      body.reason,
      user.id,
    );
    return toAttentionView(attention);
  }
}
