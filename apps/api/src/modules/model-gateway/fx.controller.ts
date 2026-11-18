import { PERMISSION } from '@cip/shared';
import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { FxService } from './application/fx.service';
import {
  type CreateFxDto,
  createFxSchema,
  type FxViewDto,
  fxViewSchema,
} from './dto/fx.dto';

/** 汇率（/model-gateway/fx-rates）：1 原币折合 USD，只追加。 */
@ApiTags('model-gateway-fx-rates')
@Controller('model-gateway/fx-rates')
export class FxController {
  constructor(private readonly rates: FxService) {}

  @Get()
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(fxViewSchema.array()) })
  @ApiOperation({ operationId: 'mgFx0', summary: '汇率版本列表' })
  async list(): Promise<FxViewDto[]> {
    return fxViewSchema.array().parse(await this.rates.list());
  }

  @Post()
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.create_fx')
  @ApiBody({ schema: toOpenApiSchema(createFxSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(fxViewSchema) })
  @ApiOperation({ operationId: 'mgFx1', summary: '新增汇率版本' })
  async create(
    @Body(new ZodValidationPipe(createFxSchema)) dto: CreateFxDto,
  ): Promise<FxViewDto> {
    return fxViewSchema.parse(
      await this.rates.create({
        quoteCurrency: dto.quoteCurrency,
        rateToBase: dto.rateToBase,
        effectiveFrom: dto.effectiveFrom,
      }),
    );
  }
}
