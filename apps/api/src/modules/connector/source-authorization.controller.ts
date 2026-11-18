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
import {
  CurrentUser,
  RequirePermission,
  type SessionUser,
} from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { SourceAuthorizationService } from './application/source-authorization.service';
import {
  type AuthorizeSourceRequest,
  authorizeSourceSchema,
} from './dto/source-authorization.dto';
import {
  sourceAuthorizationListResponseSchema,
  sourceAuthorizationViewSchema,
} from './dto/source-authorization-view.dto';

/** 来源授权视图。 */
interface SourceAuthorizationView {
  /** 主键。 */
  id: string;
  /** 范围标识。 */
  scopeKey: string;
  /** 授权人。 */
  authorizedBy: string;
  /** 到期时间。 */
  expiresAt?: string;
  /** 撤销时间。 */
  revokedAt?: string;
  /** 是否有效。 */
  active: boolean;
  /** 创建时间。 */
  createdAt: string;
}

/** 来源授权管理入口：群/范围授权、撤销与查看。 */
@ApiTags('connector')
@Controller('connector/sources')
export class SourceAuthorizationController {
  constructor(private readonly authorizations: SourceAuthorizationService) {}

  /** 列出实例授权。 */
  @Get(':id/authorizations')
  @RequirePermission(PERMISSION.source.configure.code)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '来源授权列表' })
  @ApiOkResponse({
    schema: toOpenApiSchema(sourceAuthorizationListResponseSchema),
  })
  async list(
    @Param('id') id: string,
  ): Promise<{ items: SourceAuthorizationView[] }> {
    const items = await this.authorizations.list(id);
    return { items: items.map(toView) };
  }

  /** 授权范围。 */
  @Post(':id/authorizations')
  @HttpCode(200)
  @RequirePermission(PERMISSION.source.configure.code)
  @Audit('source.authorize')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: toOpenApiSchema(authorizeSourceSchema) })
  @ApiOperation({ summary: '授权来源范围' })
  @ApiOkResponse({ schema: toOpenApiSchema(sourceAuthorizationViewSchema) })
  async authorize(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(authorizeSourceSchema))
    body: AuthorizeSourceRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<SourceAuthorizationView> {
    const authorization = await this.authorizations.authorize({
      sourceInstanceId: id,
      scopeKey: body.scopeKey,
      authorizedBy: user.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
    return toView(authorization);
  }

  /** 撤销授权。 */
  @Delete(':id/authorizations/:scopeKey')
  @RequirePermission(PERMISSION.source.configure.code)
  @Audit('source.revoke')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'scopeKey', type: String })
  @ApiOperation({ summary: '撤销来源范围授权' })
  @ApiOkResponse({ description: '是否撤销' })
  async revoke(
    @Param('id') id: string,
    @Param('scopeKey') scopeKey: string,
  ): Promise<{ revoked: boolean }> {
    return {
      revoked: await this.authorizations.revoke(
        id,
        decodeURIComponent(scopeKey),
      ),
    };
  }
}

/** 授权 → 视图。 */
function toView(authorization: {
  id: string;
  scopeKey: string;
  authorizedBy: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  isActive: () => boolean;
  createdAt: Date;
}): SourceAuthorizationView {
  return {
    id: authorization.id,
    scopeKey: authorization.scopeKey,
    authorizedBy: authorization.authorizedBy,
    ...(authorization.expiresAt
      ? { expiresAt: authorization.expiresAt.toISOString() }
      : {}),
    ...(authorization.revokedAt
      ? { revokedAt: authorization.revokedAt.toISOString() }
      : {}),
    active: authorization.isActive(),
    createdAt: authorization.createdAt.toISOString(),
  };
}
