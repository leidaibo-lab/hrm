import type { TableQueryRequestBody } from '@cip/shared';
import { PERMISSION, planTableQuery } from '@cip/shared';
import { Body, Controller, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { UserService } from './application/user.service';
import {
  type SetUserRolesDto,
  type SetUserStatusDto,
  setUserRolesSchema,
  setUserStatusSchema,
  type UserViewDto,
  userQueryBodySchema,
  userQueryResponseSchema,
  usersQueryDef,
  userViewSchema,
} from './dto/user.dto';

/**
 * 用户管理的入口集合；表格查询走 POST /query 只读端点，写操作全量落审计。
 */
@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** TableView 结构化查询：字段/操作符白名单校验（违规 400），显式 200，无业务写入。 */
  @Post('query')
  @HttpCode(200)
  @RequirePermission(PERMISSION.user.manage.code)
  @ApiBody({ schema: toOpenApiSchema(userQueryBodySchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(userQueryResponseSchema) })
  @ApiOperation({ summary: '用户表格查询（搜索/筛选/多列排序/分页）' })
  async query(
    @Body(new ZodValidationPipe(userQueryBodySchema))
    body: TableQueryRequestBody,
  ): Promise<unknown> {
    const request = planTableQuery(usersQueryDef, body);
    return userQueryResponseSchema.parse(
      await this.userService.queryTable(request),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Put(':id/status')
  @RequirePermission(PERMISSION.user.manage.code)
  @Audit('user.set_status')
  @ApiBody({ schema: toOpenApiSchema(setUserStatusSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(userViewSchema) })
  @ApiOperation({ summary: '启停用户' })
  async setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setUserStatusSchema)) dto: SetUserStatusDto,
  ): Promise<UserViewDto> {
    return userViewSchema.parse(
      await this.userService.setStatus(id, dto.status),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Put(':id/roles')
  @RequirePermission(PERMISSION.user.manage.code)
  @Audit('user.set_roles')
  @ApiBody({ schema: toOpenApiSchema(setUserRolesSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(userViewSchema) })
  @ApiOperation({ summary: '全量替换用户角色' })
  async setRoles(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setUserRolesSchema)) dto: SetUserRolesDto,
  ): Promise<UserViewDto> {
    return userViewSchema.parse(
      await this.userService.setRoles(id, dto.roleIds),
    );
  }
}
