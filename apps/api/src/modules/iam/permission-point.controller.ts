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
import { PermissionService } from './application/permission.service';
import {
  type PermissionPointViewDto,
  permissionPointViewSchema,
  type UpdatePermissionSummaryDto,
  updatePermissionSummarySchema,
} from './dto/permission.dto';

/** 权限点管理入口：目录 ⊕ 覆盖合并的清单与摘要覆盖。 */
@ApiTags('permission-points')
@Controller('permission-points')
export class PermissionPointController {
  constructor(private readonly permissionService: PermissionService) {}

  /** 权限点清单：目录 ⊕ 覆盖合并（配置页勾选与权限点管理共用）。 */
  @Get()
  @RequirePermission(PERMISSION.role.manage.code)
  @ApiOkResponse({
    schema: toOpenApiSchema(z.array(permissionPointViewSchema)),
  })
  @ApiOperation({ summary: '权限点清单（目录⊕覆盖）' })
  async list(): Promise<PermissionPointViewDto[]> {
    const views = await this.permissionService.list();
    return z.array(permissionPointViewSchema).parse(views);
  }

  @ApiParam({ name: 'code', type: String, required: true })
  @Put(':code/summary')
  @RequirePermission(PERMISSION.permissionPoint.manage.code)
  @Audit('permission-point.set_summary')
  @ApiBody({ schema: toOpenApiSchema(updatePermissionSummarySchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(permissionPointViewSchema) })
  @ApiOperation({ summary: '覆盖权限点摘要' })
  async updateSummary(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(updatePermissionSummarySchema))
    dto: UpdatePermissionSummaryDto,
  ): Promise<PermissionPointViewDto> {
    return permissionPointViewSchema.parse(
      await this.permissionService.updateSummary(code, dto.summary),
    );
  }
}
