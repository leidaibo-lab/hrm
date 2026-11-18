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
import { RequirePermission } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { RoleService } from './application/role.service';
import {
  type CreateRoleDto,
  createRoleSchema,
  type RoleViewDto,
  roleQueryBodySchema,
  roleQueryResponseSchema,
  rolesQueryDef,
  roleViewSchema,
  type SetRolePermissionsDto,
  setRolePermissionsSchema,
  type UpdateRoleDto,
  updateRoleSchema,
} from './dto/role.dto';

/**
 * 角色管理的入口集合；表格查询走 POST /query 只读端点，写操作全量落审计，授权为全量替换语义。
 */
@ApiTags('roles')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /** TableView 结构化查询：字段/操作符白名单校验（违规 400），显式 200，无业务写入。 */
  @Post('query')
  @HttpCode(200)
  @RequirePermission(PERMISSION.role.manage.code)
  @ApiBody({ schema: toOpenApiSchema(roleQueryBodySchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(roleQueryResponseSchema) })
  @ApiOperation({ summary: '角色表格查询（搜索/筛选/多列排序/分页）' })
  async query(
    @Body(new ZodValidationPipe(roleQueryBodySchema))
    body: TableQueryRequestBody,
  ): Promise<unknown> {
    const request = planTableQuery(rolesQueryDef, body);
    return roleQueryResponseSchema.parse(
      await this.roleService.queryTable(request),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Get(':id')
  @RequirePermission(PERMISSION.role.manage.code)
  @ApiOkResponse({ schema: toOpenApiSchema(roleViewSchema) })
  @ApiOperation({ summary: '角色详情' })
  async get(@Param('id') id: string): Promise<RoleViewDto> {
    return roleViewSchema.parse(await this.roleService.getDetail(id));
  }

  @Post()
  @RequirePermission(PERMISSION.role.manage.code)
  @Audit('role.create')
  @ApiBody({ schema: toOpenApiSchema(createRoleSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(roleViewSchema) })
  @ApiOperation({ summary: '创建角色' })
  async create(
    @Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleDto,
  ): Promise<RoleViewDto> {
    return roleViewSchema.parse(
      await this.roleService.create({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  // 整体资料更新用 PATCH（部分更新语义），与 model-providers 域对齐；字段型子集合替换仍用 PUT（CON-5.2）
  @Patch(':id')
  @RequirePermission(PERMISSION.role.manage.code)
  @Audit('role.update')
  @ApiBody({ schema: toOpenApiSchema(updateRoleSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(roleViewSchema) })
  @ApiOperation({ summary: '更新角色' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) dto: UpdateRoleDto,
  ): Promise<RoleViewDto> {
    return roleViewSchema.parse(
      await this.roleService.update(id, {
        name: dto.name,
        description: dto.description ?? null,
      }),
    );
  }

  /** 全量替换角色 × 权限点授予关系（后台角色编辑页保存）。 */
  @ApiParam({ name: 'id', type: String, required: true })
  @Put(':id/permission-points')
  @RequirePermission(PERMISSION.role.manage.code)
  @Audit('role.set_permissions')
  @ApiBody({ schema: toOpenApiSchema(setRolePermissionsSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(roleViewSchema) })
  @ApiOperation({ summary: '全量替换角色权限点' })
  async setPermissionPoints(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setRolePermissionsSchema))
    dto: SetRolePermissionsDto,
  ): Promise<RoleViewDto> {
    return roleViewSchema.parse(
      await this.roleService.setPermissionPoints(id, dto.permissionCodes),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Delete(':id')
  @RequirePermission(PERMISSION.role.manage.code)
  @Audit('role.delete')
  @ApiOperation({ summary: '删除角色' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.roleService.remove(id);
  }
}
