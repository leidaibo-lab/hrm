import { PERMISSION } from '@cip/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
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
import { ScopeAccessService } from './application/scope-access.service';
import {
  type GrantScopeMemberRequest,
  grantScopeMemberSchema,
} from './dto/scope.dto';

/** 数据范围成员视图。 */
interface ScopeMemberView {
  /** 主键。 */
  id: string;
  /** 平台用户标识。 */
  userId: string;
  /** 项目或空间标识。 */
  scopeKey: string;
  /** 创建时间。 */
  createdAt: string;
}

/** 数据范围成员管理入口：V0 借用 policy:configure 管理权限。 */
@ApiTags('agentic')
@Controller('agentic/scopes')
export class ScopeController {
  constructor(private readonly scopes: ScopeAccessService) {}

  /** 列出范围成员。 */
  @Get(':scopeKey/members')
  @RequirePermission(PERMISSION.policy.configure.code)
  @ApiParam({ name: 'scopeKey', type: String })
  @ApiOperation({ summary: '范围成员列表' })
  @ApiOkResponse({ description: '范围成员' })
  async list(
    @Param('scopeKey') scopeKey: string,
  ): Promise<{ items: ScopeMemberView[] }> {
    const members = await this.scopes.listMembers(scopeKey);
    return {
      items: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        scopeKey: member.scopeKey,
        createdAt: member.createdAt.toISOString(),
      })),
    };
  }

  /** 授权成员。 */
  @Post(':scopeKey/members')
  @HttpCode(200)
  @RequirePermission(PERMISSION.policy.configure.code)
  @Audit('scope.member.grant')
  @ApiParam({ name: 'scopeKey', type: String })
  @ApiBody({ schema: toOpenApiSchema(grantScopeMemberSchema) })
  @ApiOperation({ summary: '授权范围成员' })
  @ApiOkResponse({ description: '成员关系' })
  async grant(
    @Param('scopeKey') scopeKey: string,
    @Body(new ZodValidationPipe(grantScopeMemberSchema))
    body: GrantScopeMemberRequest,
  ): Promise<ScopeMemberView> {
    const member = await this.scopes.grant({
      userId: body.userId,
      scopeKey,
    });
    return {
      id: member.id,
      userId: member.userId,
      scopeKey: member.scopeKey,
      createdAt: member.createdAt.toISOString(),
    };
  }

  /** 撤销成员。 */
  @Delete(':scopeKey/members/:userId')
  @RequirePermission(PERMISSION.policy.configure.code)
  @Audit('scope.member.revoke')
  @ApiParam({ name: 'scopeKey', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiOperation({ summary: '撤销范围成员' })
  @ApiOkResponse({ description: '是否删除' })
  async revoke(
    @Param('scopeKey') scopeKey: string,
    @Param('userId') userId: string,
  ): Promise<{ removed: boolean }> {
    return { removed: await this.scopes.revoke(userId, scopeKey) };
  }
}
