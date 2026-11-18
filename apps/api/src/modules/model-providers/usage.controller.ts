import type { TableQueryRequestBody } from '@cip/shared';
import { PERMISSION, planTableQuery } from '@cip/shared';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { ModelUsageService } from './application/model-usage.service';
import {
  usageQueryBodySchema,
  usageQueryResponseSchema,
  usagesQueryDef,
} from './dto/usage.dto';

/** 用量报表入口（/ai/usages）：表格查询走 POST /query，汇总放 meta（同筛选条件跨页统计）。 */
@ApiTags('ai-usages')
@Controller('ai/usages')
export class UsageController {
  constructor(private readonly usages: ModelUsageService) {}

  /** TableView 结构化查询：字段/操作符白名单校验（违规 400），显式 200，无业务写入。 */
  @Post('query')
  @HttpCode(200)
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiBody({ schema: toOpenApiSchema(usageQueryBodySchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(usageQueryResponseSchema) })
  @ApiOperation({ summary: '用量报表查询（搜索/筛选/多列排序/分页/汇总）' })
  async query(
    @Body(new ZodValidationPipe(usageQueryBodySchema))
    body: TableQueryRequestBody,
  ): Promise<unknown> {
    const request = planTableQuery(usagesQueryDef, body);
    return usageQueryResponseSchema.parse(
      await this.usages.queryTable(request),
    );
  }
}
