import { PERMISSION } from '@cip/shared';
import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { toOpenApiSchema } from '../../openapi';
import { RequirePermission } from '../../pipeline/guards';
import { CatalogService } from './application/catalog.service';
import {
  type CatalogProviderDto,
  catalogProviderSchema,
} from './dto/catalog.dto';

/** models.dev 目录代理（/ai/catalog）：导入向导的数据源；上游不可达时 503。 */
@ApiTags('ai-catalog')
@Controller('ai/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(z.array(catalogProviderSchema)) })
  @ApiOperation({ summary: 'models.dev 目录' })
  async list(): Promise<CatalogProviderDto[]> {
    return z.array(catalogProviderSchema).parse(await this.catalog.list());
  }

  @ApiParam({ name: 'providerId', type: String, required: true })
  @Get(':providerId')
  @RequirePermission(PERMISSION.modelProvider.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(catalogProviderSchema) })
  @ApiOperation({ summary: '目录服务商详情' })
  async get(
    @Param('providerId') providerId: string,
  ): Promise<CatalogProviderDto> {
    return catalogProviderSchema.parse(await this.catalog.get(providerId));
  }
}
