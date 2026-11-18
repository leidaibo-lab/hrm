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
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import { CallContextCaller } from '../../pipeline/call-context';
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { ModelProviderService } from './application/model-provider.service';
import { ProviderModelService } from './application/provider-model.service';
import {
  type CreateModelDto,
  createModelSchema,
  type ModelViewDto,
  modelViewSchema,
} from './dto/model.dto';
import {
  type CreateModelImportDto,
  createModelImportSchema,
  type ModelImportResultDto,
  modelImportResultSchema,
} from './dto/model-import.dto';
import {
  type CreateProviderDto,
  createProviderSchema,
  type ProviderViewDto,
  providerQueryBodySchema,
  providerQueryResponseSchema,
  providersQueryDef,
  providerViewSchema,
  type SetEnabledDto,
  setEnabledSchema,
  type TestConnectionResultDto,
  testConnectionResultSchema,
  type UpdateProviderDto,
  updateProviderSchema,
} from './dto/provider.dto';

/**
 * 供应商管理入口（/ai/providers，对应约定 领域前缀段）：
 * 表格查询走 POST /query 只读端点；写操作全量落审计；凭据明文仅出现在创建/轮换请求，响应永不回传。
 */
@ApiTags('ai-providers')
@Controller('ai/providers')
@CallContextCaller('gateway-admin')
export class ProviderController {
  constructor(
    private readonly providers: ModelProviderService,
    private readonly models: ProviderModelService,
  ) {}

  /** TableView 结构化查询：字段/操作符白名单校验（违规 400），显式 200，无业务写入。 */
  @Post('query')
  @HttpCode(200)
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiBody({ schema: toOpenApiSchema(providerQueryBodySchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(providerQueryResponseSchema) })
  @ApiOperation({ summary: '供应商表格查询（搜索/筛选/多列排序/分页）' })
  async query(
    @Body(new ZodValidationPipe(providerQueryBodySchema))
    body: TableQueryRequestBody,
  ): Promise<unknown> {
    const request = planTableQuery(providersQueryDef, body);
    return providerQueryResponseSchema.parse(
      await this.providers.queryTable(request),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Get(':id')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ summary: '供应商详情' })
  async get(@Param('id') id: string): Promise<ProviderViewDto> {
    return providerViewSchema.parse(await this.providers.getDetail(id));
  }

  @Post()
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.create')
  @ApiBody({ schema: toOpenApiSchema(createProviderSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ summary: '创建供应商' })
  async create(
    @Body(new ZodValidationPipe(createProviderSchema)) dto: CreateProviderDto,
  ): Promise<ProviderViewDto> {
    return providerViewSchema.parse(
      await this.providers.create({
        slug: dto.slug,
        name: dto.name,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey,
        timeoutMs: dto.timeoutMs ?? null,
        rateLimitPerMinute: dto.rateLimitPerMinute ?? null,
        maxConcurrent: dto.maxConcurrent ?? null,
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Patch(':id')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.update')
  @ApiBody({ schema: toOpenApiSchema(updateProviderSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ summary: '更新供应商' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProviderSchema)) dto: UpdateProviderDto,
  ): Promise<ProviderViewDto> {
    return providerViewSchema.parse(
      await this.providers.update(id, {
        name: dto.name,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey,
        timeoutMs: dto.timeoutMs ?? null,
        rateLimitPerMinute: dto.rateLimitPerMinute ?? null,
        maxConcurrent: dto.maxConcurrent ?? null,
      }),
    );
  }

  /** 启停供应商：字段型状态独立子资源。 */
  @ApiParam({ name: 'id', type: String, required: true })
  @Put(':id/enabled')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.set_enabled')
  @ApiBody({ schema: toOpenApiSchema(setEnabledSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ summary: '启停供应商' })
  async setEnabled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setEnabledSchema)) dto: SetEnabledDto,
  ): Promise<ProviderViewDto> {
    return providerViewSchema.parse(
      await this.providers.setEnabled(id, dto.enabled),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Delete(':id')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.delete')
  @ApiOperation({ summary: '删除供应商' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.providers.remove(id);
  }

  /** 连通性测试：真实拉一次上游模型清单，结果结构化返回。 */
  @ApiParam({ name: 'id', type: String, required: true })
  @Post(':id/test')
  @CallContextCaller('admin-test')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.test')
  @ApiOkResponse({ schema: toOpenApiSchema(testConnectionResultSchema) })
  @ApiOperation({ summary: '连通性测试' })
  async testConnection(
    @Param('id') id: string,
  ): Promise<TestConnectionResultDto> {
    return testConnectionResultSchema.parse(
      await this.providers.testConnectivity(id),
    );
  }

  /** 注册模型（创建挂在供应商上，聚合关系可见）。 */
  @ApiParam({ name: 'id', type: String, required: true })
  @Post(':id/models')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.create_model')
  @ApiBody({ schema: toOpenApiSchema(createModelSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(modelViewSchema) })
  @ApiOperation({ summary: '在供应商下注册模型' })
  async createModel(
    @Param('id') providerId: string,
    @Body(new ZodValidationPipe(createModelSchema)) dto: CreateModelDto,
  ): Promise<ModelViewDto> {
    return modelViewSchema.parse(
      await this.models.create(providerId, {
        modelId: dto.modelId,
        logicalKey: dto.logicalKey,
        displayName: dto.displayName,
        capabilities: dto.capabilities,
        defaultParams: dto.defaultParams ?? null,
      }),
    );
  }
  /** 同一模型与初始价格原子注册，批次返回逐项结果。 */
  @ApiParam({ name: 'id', type: String, required: true })
  @Post(':id/import')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @Audit('model-provider.import')
  @ApiBody({ schema: toOpenApiSchema(createModelImportSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(modelImportResultSchema) })
  @ApiOperation({ summary: '从目录导入选中模型' })
  async createImport(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createModelImportSchema))
    dto: CreateModelImportDto,
  ): Promise<ModelImportResultDto> {
    return modelImportResultSchema.parse(
      await this.models.createImport(id, dto),
    );
  }
}
