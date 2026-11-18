import type { TableQueryRequestBody } from '@cip/shared';
import { PERMISSION, planTableQuery } from '@cip/shared';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { UsageService } from './application/usage.service';
import {
  usageQueryBodySchema,
  usageQueryResponseSchema,
  usageSummaryQuerySchema,
  usageSummarySchema,
  usagesQueryDef,
} from './dto/usage.dto';

/** 用量报表（/model-gateway/usages）：结构化查询与汇总，成本按 USD 求和。 */
@ApiTags('model-gateway-usages')
@Controller('model-gateway/usages')
export class UsageController {
  constructor(private readonly usages: UsageService) {}

  @Post('query')
  @HttpCode(200)
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiBody({ schema: toOpenApiSchema(usageQueryBodySchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(usageQueryResponseSchema) })
  @ApiOperation({
    operationId: 'mgUsage0',
    summary: '用量报表查询（筛选/排序/分页/汇总）',
  })
  async query(
    @Body(new ZodValidationPipe(usageQueryBodySchema))
    body: TableQueryRequestBody,
  ): Promise<unknown> {
    const request = planTableQuery(usagesQueryDef, body);
    return usageQueryResponseSchema.parse(
      await this.usages.queryTable(request),
    );
  }

  @Get('summary')
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(usageSummarySchema) })
  @ApiOperation({ operationId: 'mgUsage1', summary: '用量成本汇总' })
  async summary(
    @Query(new ZodValidationPipe(usageSummaryQuerySchema))
    query: {
      spaceId?: string;
      agentKey?: string;
      logicalKey?: string;
      from?: string;
      to?: string;
    },
  ): Promise<unknown> {
    return usageSummarySchema.parse(await this.usages.summary(query));
  }
}
