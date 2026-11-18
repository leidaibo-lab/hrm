import type { TableQueryRequestBody } from '@cip/shared';
import { PERMISSION, planTableQuery } from '@cip/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import { CallContextCaller } from '../../pipeline/call-context';
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { ModelPricingService } from './application/model-pricing.service';
import {
  type CapabilityFilterKey,
  ProviderModelService,
} from './application/provider-model.service';
import {
  type DefaultModelParamsDto,
  type ModelCapabilitiesDto,
  type ModelViewDto,
  modelQueryBodySchema,
  modelQueryResponseSchema,
  modelsQueryDef,
  modelViewSchema,
  type SetEnabledDto,
  setEnabledSchema,
  type UpdateModelDto,
  updateModelSchema,
} from './dto/model.dto';
import {
  type CreatePricingDto,
  createPricingSchema,
  type PricingVersionViewDto,
  pricingVersionViewSchema,
} from './dto/pricing.dto';

const capabilityQuerySchema = z.object({
  'filter.providerId': z.string().optional(),
  capability: z
    .enum([
      'toolCall',
      'imageInput',
      'audioInput',
      'structuredOutput',
      'reasoning',
      'embedding',
    ])
    .optional(),
});

/** 模型管理入口（/ai/models）：跨供应商总览、能力筛选、模型详情与价格版本。 */
@ApiTags('ai-models')
@Controller('ai/models')
@CallContextCaller('gateway-admin')
export class ModelController {
  constructor(
    private readonly models: ProviderModelService,
    private readonly pricing: ModelPricingService,
  ) {}

  /** TableView 结构化查询：scope.providerId 服务端强制校验组合，显式 200，无业务写入。 */
  @Post('query')
  @HttpCode(200)
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiBody({ schema: toOpenApiSchema(modelQueryBodySchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(modelQueryResponseSchema) })
  @ApiOperation({ summary: '模型表格查询（范围/搜索/筛选/多列排序/分页）' })
  async query(
    @Body(new ZodValidationPipe(modelQueryBodySchema))
    body: TableQueryRequestBody,
  ): Promise<unknown> {
    const request = planTableQuery(modelsQueryDef, body);
    return modelQueryResponseSchema.parse(
      await this.models.queryTable(request),
    );
  }

  @Get()
  @ApiQuery({ name: 'filter.providerId', required: false, type: String })
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiQuery({
    name: 'capability',
    required: false,
    schema: {
      type: 'string',
      enum: [
        'toolCall',
        'imageInput',
        'audioInput',
        'structuredOutput',
        'reasoning',
        'embedding',
      ],
    },
  })
  @ApiOkResponse({ schema: toOpenApiSchema(z.array(modelViewSchema)) })
  @ApiOperation({ summary: '模型列表/能力筛选' })
  async list(
    @Query(new ZodValidationPipe(capabilityQuerySchema))
    query: { capability?: CapabilityFilterKey; 'filter.providerId'?: string },
  ): Promise<ModelViewDto[]> {
    const items =
      query.capability === undefined
        ? await this.models.listAll(query['filter.providerId'])
        : await this.models.listWithCapability(
            query.capability,
            query['filter.providerId'],
          );
    return z.array(modelViewSchema).parse(items);
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Get(':id')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(modelViewSchema) })
  @ApiOperation({ summary: '模型详情' })
  async get(@Param('id') id: string): Promise<ModelViewDto> {
    return modelViewSchema.parse(await this.models.getDetail(id));
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Patch(':id')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.update_model')
  @ApiBody({ schema: toOpenApiSchema(updateModelSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(modelViewSchema) })
  @ApiOperation({ summary: '更新模型' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateModelSchema)) dto: UpdateModelDto,
  ): Promise<ModelViewDto> {
    return modelViewSchema.parse(
      await this.models.update(id, {
        displayName: dto.displayName,
        capabilities: dto.capabilities as ModelCapabilitiesDto | undefined,
        defaultParams:
          dto.defaultParams === undefined
            ? undefined
            : (dto.defaultParams as DefaultModelParamsDto | null),
      }),
    );
  }

  /** 启停模型：字段型状态独立子资源。 */
  @ApiParam({ name: 'id', type: String, required: true })
  @Put(':id/enabled')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.set_model_enabled')
  @ApiBody({ schema: toOpenApiSchema(setEnabledSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(modelViewSchema) })
  @ApiOperation({ summary: '启停模型' })
  async setEnabled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setEnabledSchema)) dto: SetEnabledDto,
  ): Promise<ModelViewDto> {
    return modelViewSchema.parse(await this.models.setEnabled(id, dto.enabled));
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Delete(':id')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.delete_model')
  @ApiOperation({ summary: '删除模型' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.models.remove(id);
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Get(':id/pricings')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(z.array(pricingVersionViewSchema)) })
  @ApiOperation({ summary: '价格版本列表' })
  async listPricings(
    @Param('id') modelId: string,
  ): Promise<PricingVersionViewDto[]> {
    return z
      .array(pricingVersionViewSchema)
      .parse(await this.pricing.listVersions(modelId));
  }

  /** 新增价格版本（一版一行；可预设未来生效）。 */
  @ApiParam({ name: 'id', type: String, required: true })
  @Post(':id/pricings')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.create_pricing')
  @ApiBody({ schema: toOpenApiSchema(createPricingSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(pricingVersionViewSchema) })
  @ApiOperation({ summary: '新增价格版本' })
  async createPricing(
    @Param('id') modelId: string,
    @Body(new ZodValidationPipe(createPricingSchema)) dto: CreatePricingDto,
  ): Promise<PricingVersionViewDto> {
    return pricingVersionViewSchema.parse(
      await this.pricing.createVersion(modelId, {
        currency: dto.currency,
        input: dto.input,
        output: dto.output,
        cacheRead: dto.cacheRead ?? null,
        cacheWrite: dto.cacheWrite ?? null,
        reasoning: dto.reasoning ?? null,
        effectiveFrom: dto.effectiveFrom,
      }),
    );
  }
}
