import { PERMISSION } from '@cip/shared';
import {
  Body,
  Controller,
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
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { ProviderService } from './application/provider.service';
import {
  type CreateProviderDto,
  createProviderSchema,
  type ProviderConnectionDto,
  type ProviderViewDto,
  providerConnectionSchema,
  providerViewSchema,
  type SetProviderEnabledDto,
  setProviderEnabledSchema,
  type UpdateProviderDto,
  updateProviderSchema,
} from './dto/provider.dto';

/** 供应商管理入口（/model-gateway/providers）：凭据只进不出，写操作全量落审计。 */
@ApiTags('model-gateway-providers')
@Controller('model-gateway/providers')
export class ProviderController {
  constructor(private readonly providers: ProviderService) {}

  @Get()
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(providerViewSchema.array()) })
  @ApiOperation({ operationId: 'mgProvider0', summary: '供应商列表' })
  async list(): Promise<ProviderViewDto[]> {
    return providerViewSchema.array().parse(await this.providers.list());
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Get(':id')
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ operationId: 'mgProvider1', summary: '供应商详情' })
  async get(@Param('id') id: string): Promise<ProviderViewDto> {
    return providerViewSchema.parse(await this.providers.get(id));
  }

  @Post()
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.create_provider')
  @ApiBody({ schema: toOpenApiSchema(createProviderSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ operationId: 'mgProvider2', summary: '创建供应商' })
  async create(
    @Body(new ZodValidationPipe(createProviderSchema)) dto: CreateProviderDto,
  ): Promise<ProviderViewDto> {
    return providerViewSchema.parse(
      await this.providers.create({
        name: dto.name,
        slug: dto.slug,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey,
        catalogProviderId: dto.catalogProviderId ?? null,
        timeoutMs: dto.timeoutMs ?? null,
        rateLimitPerMinute: dto.rateLimitPerMinute ?? null,
        maxConcurrent: dto.maxConcurrent ?? null,
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Patch(':id')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.update_provider')
  @ApiBody({ schema: toOpenApiSchema(updateProviderSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ operationId: 'mgProvider3', summary: '更新供应商' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProviderSchema))
    dto: UpdateProviderDto,
  ): Promise<ProviderViewDto> {
    return providerViewSchema.parse(
      await this.providers.update(id, {
        name: dto.name,
        baseUrl: dto.baseUrl,
        ...(dto.apiKey === undefined ? {} : { apiKey: dto.apiKey }),
        ...(dto.catalogProviderId === undefined
          ? {}
          : { catalogProviderId: dto.catalogProviderId }),
        ...(dto.timeoutMs === undefined ? {} : { timeoutMs: dto.timeoutMs }),
        ...(dto.rateLimitPerMinute === undefined
          ? {}
          : { rateLimitPerMinute: dto.rateLimitPerMinute }),
        ...(dto.maxConcurrent === undefined
          ? {}
          : { maxConcurrent: dto.maxConcurrent }),
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Put(':id/enabled')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.set_provider_enabled')
  @ApiBody({ schema: toOpenApiSchema(setProviderEnabledSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(providerViewSchema) })
  @ApiOperation({ operationId: 'mgProvider4', summary: '启停供应商' })
  async setEnabled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setProviderEnabledSchema))
    dto: SetProviderEnabledDto,
  ): Promise<ProviderViewDto> {
    return providerViewSchema.parse(
      await this.providers.setEnabled(id, dto.enabled),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Post(':id/test')
  @HttpCode(200)
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.test_provider')
  @ApiOkResponse({ schema: toOpenApiSchema(providerConnectionSchema) })
  @ApiOperation({ operationId: 'mgProvider5', summary: '供应商连通性测试' })
  async test(@Param('id') id: string): Promise<ProviderConnectionDto> {
    return providerConnectionSchema.parse(
      await this.providers.testConnectivity(id),
    );
  }
}
