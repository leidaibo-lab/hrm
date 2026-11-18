import { PERMISSION } from '@cip/shared';
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { NavigationService } from './application/navigation.service';
import {
  type NavigationNodeViewDto,
  navigationNodeViewSchema,
  type UpdateNavigationOverrideDto,
  updateNavigationOverrideSchema,
} from './dto/navigation.dto';

/** 导航覆盖管理入口：目录默认与运营覆盖并列展示。 */
@ApiTags('navigation-nodes')
@Controller('navigation-nodes')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  /** 导航覆盖清单：目录默认与覆盖并列（菜单管理页）。 */
  @Get()
  @RequirePermission(PERMISSION.navigation.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(z.array(navigationNodeViewSchema)) })
  @ApiOperation({ summary: '导航覆盖清单' })
  async list(): Promise<NavigationNodeViewDto[]> {
    const views = await this.navigationService.list();
    return z.array(navigationNodeViewSchema).parse(views);
  }

  @ApiParam({ name: 'code', type: String, required: true })
  @Put(':code')
  @RequirePermission(PERMISSION.navigation.manage.code)
  @Audit('navigation.set_override')
  @ApiBody({ schema: toOpenApiSchema(updateNavigationOverrideSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(navigationNodeViewSchema) })
  @ApiOperation({ summary: '更新导航覆盖' })
  async update(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(updateNavigationOverrideSchema))
    dto: UpdateNavigationOverrideDto,
  ): Promise<NavigationNodeViewDto> {
    return navigationNodeViewSchema.parse(
      await this.navigationService.updateOverride(code, {
        title: dto.title,
        icon: dto.icon,
        sort: dto.sort,
        visible: dto.visible,
      }),
    );
  }
}
