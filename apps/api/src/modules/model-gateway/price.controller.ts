import { PERMISSION } from '@cip/shared';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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
import { PriceService } from './application/price.service';
import {
  type CreatePriceDto,
  createPriceSchema,
  type PriceViewDto,
  priceViewSchema,
} from './dto/price.dto';

/** 价格版本（/model-gateway/candidates/:id/prices）：手动价只追加，目录价只读。 */
@ApiTags('model-gateway-prices')
@Controller('model-gateway/candidates')
export class PriceController {
  constructor(private readonly prices: PriceService) {}

  @ApiParam({ name: 'id', type: String, required: true })
  @Get(':id/prices')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(priceViewSchema.array()) })
  @ApiOperation({ operationId: 'mgPrice0', summary: '候选价格版本列表' })
  async list(@Param('id') id: string): Promise<PriceViewDto[]> {
    return priceViewSchema.array().parse(await this.prices.list(id));
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Post(':id/prices')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.create_price')
  @ApiBody({ schema: toOpenApiSchema(createPriceSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(priceViewSchema) })
  @ApiOperation({ operationId: 'mgPrice1', summary: '新增手动价格版本' })
  async create(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createPriceSchema)) dto: CreatePriceDto,
  ): Promise<PriceViewDto> {
    return priceViewSchema.parse(
      await this.prices.createManual(id, {
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

  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'priceId', type: String, required: true })
  @Delete(':id/prices/:priceId')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.delete_price')
  @ApiOperation({ operationId: 'mgPrice2', summary: '删除未被引用的价格版本' })
  async remove(
    @Param('id') id: string,
    @Param('priceId') priceId: string,
  ): Promise<void> {
    await this.prices.remove(id, priceId);
  }
}
