import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { InternalTokenGuard, Public } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { RetentionService } from './application/retention.service';

/** 删除请求：必须带确认串。 */
const applyRetentionSchema = z.object({
  /** 确认串（DELETE_EXPIRED）。 */
  confirm: z.string().min(1),
});

/** 保留归档内部端点：预检与显式删除。 */
@ApiTags('internal')
@Controller('internal')
@Public()
@UseGuards(InternalTokenGuard)
export class InternalRetentionController {
  constructor(private readonly retention: RetentionService) {}

  /** 预检过期记录。 */
  @Get('retention')
  @ApiOperation({ summary: '内部：保留归档预检' })
  @ApiOkResponse({ description: '过期计数与阈值' })
  preview(): ReturnType<RetentionService['preview']> {
    return this.retention.preview();
  }

  /** 物理删除过期记录（需开关 + 确认串）。 */
  @Post('retention/apply')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['confirm'],
      properties: { confirm: { type: 'string' } },
    },
  })
  @ApiOperation({ summary: '内部：执行保留归档删除' })
  @ApiOkResponse({ description: '删除计数' })
  apply(
    @Body(new ZodValidationPipe(applyRetentionSchema))
    body: { confirm: string },
  ): ReturnType<RetentionService['apply']> {
    return this.retention.apply(body.confirm);
  }
}
