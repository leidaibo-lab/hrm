import { PERMISSION } from '@cip/shared';
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import { RequirePermission } from '../../pipeline/guards';
import { CatalogService } from './application/catalog.service';
import {
  type CatalogProviderDto,
  type CatalogSyncDto,
  catalogProviderSchema,
  catalogSyncSchema,
} from './dto/catalog.dto';

/** models.dev 目录（/model-gateway/catalog）：预览、同步、同步记录。 */
@ApiTags('model-gateway-catalog')
@Controller('model-gateway/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(catalogProviderSchema.array()) })
  @ApiOperation({ operationId: 'mgCatalog0', summary: 'models.dev 目录预览' })
  async list(): Promise<CatalogProviderDto[]> {
    return catalogProviderSchema.array().parse(await this.catalog.list());
  }

  @Get('syncs')
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(catalogSyncSchema.array()) })
  @ApiOperation({ operationId: 'mgCatalog1', summary: '目录同步记录' })
  async listSyncs(): Promise<CatalogSyncDto[]> {
    return catalogSyncSchema.array().parse(await this.catalog.listSyncs());
  }

  @Post('sync')
  @HttpCode(200)
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.sync_catalog')
  @ApiOkResponse({ schema: toOpenApiSchema(catalogSyncSchema) })
  @ApiOperation({
    operationId: 'mgCatalog2',
    summary: '同步 models.dev 目录价',
  })
  async sync(): Promise<CatalogSyncDto> {
    return catalogSyncSchema.parse(await this.catalog.sync());
  }

  @ApiParam({ name: 'providerId', type: String, required: true })
  @Get(':providerId')
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(catalogProviderSchema) })
  @ApiOperation({ operationId: 'mgCatalog3', summary: '目录服务商详情' })
  async get(
    @Param('providerId') providerId: string,
  ): Promise<CatalogProviderDto> {
    return catalogProviderSchema.parse(await this.catalog.get(providerId));
  }
}
