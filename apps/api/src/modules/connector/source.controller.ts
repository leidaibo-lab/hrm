import { PERMISSION } from '@cip/shared';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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
import { SourceAdminService } from './application/source-admin.service';
import { SourceHealthService } from './application/source-health.service';
import {
  type CreateSourceRequest,
  createSourceSchema,
  type UpdateSourceRequest,
  updateSourceSchema,
} from './dto/source.dto';
import {
  sourceHealthResponseSchema,
  sourceListResponseSchema,
  sourceViewSchema,
} from './dto/source-view.dto';

/** 来源实例视图。 */
interface SourceView {
  /** 实例主键。 */
  id: string;
  /** 来源类型。 */
  sourceType: string;
  /** 实例名称。 */
  name: string;
  /** 机器人标识。 */
  botId?: string;
  /** 配置负载。 */
  config: Record<string, unknown>;
  /** 是否启用。 */
  enabled: boolean;
  /** 创建时间。 */
  createdAt: string;
  /** 更新时间。 */
  updatedAt: string;
}

/** 来源实例的视图所需结构。 */
interface SourceInstanceLike {
  /** 实例主键。 */
  id: string;
  /** 来源类型。 */
  sourceType: string;
  /** 实例名称。 */
  name: string;
  /** 机器人标识。 */
  botId: string | null;
  /** 配置负载。 */
  config: unknown;
  /** 是否启用。 */
  isEnabled: boolean;
  /** 创建时间。 */
  createdAt: Date;
  /** 更新时间。 */
  updatedAt: Date;
}

/** 来源实例 → 视图。 */
function toSourceView(instance: SourceInstanceLike): SourceView {
  return {
    id: instance.id,
    sourceType: instance.sourceType,
    name: instance.name,
    ...(instance.botId ? { botId: instance.botId } : {}),
    config:
      instance.config && typeof instance.config === 'object'
        ? (instance.config as Record<string, unknown>)
        : {},
    enabled: instance.isEnabled,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}

/** 来源管理入口：实例列表与启停。 */
@ApiTags('connector')
@Controller('connector/sources')
export class SourceController {
  constructor(
    private readonly sources: SourceAdminService,
    private readonly health: SourceHealthService,
  ) {}

  /** 创建来源实例。 */
  @Post()
  @RequirePermission(PERMISSION.source.configure.code)
  @Audit('source.create')
  @ApiBody({ schema: toOpenApiSchema(createSourceSchema) })
  @ApiOperation({ summary: '创建来源实例' })
  @ApiCreatedResponse({ schema: toOpenApiSchema(sourceViewSchema) })
  async create(
    @Body(new ZodValidationPipe(createSourceSchema)) body: CreateSourceRequest,
  ): Promise<SourceView> {
    try {
      const instance = await this.sources.create(body);
      return toSourceView(instance);
    } catch (error) {
      if (error instanceof Error && error.name === 'SourceNameConflictError')
        throw new ConflictException(error.message);
      throw new BadRequestException(
        error instanceof Error ? error.message : '来源配置无效',
      );
    }
  }

  /** 修改来源实例。 */
  @Patch(':id')
  @RequirePermission(PERMISSION.source.configure.code)
  @Audit('source.update')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: toOpenApiSchema(updateSourceSchema) })
  @ApiOperation({ summary: '修改来源实例' })
  @ApiOkResponse({ schema: toOpenApiSchema(sourceViewSchema) })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSourceSchema)) body: UpdateSourceRequest,
  ): Promise<SourceView> {
    try {
      return toSourceView(await this.sources.update(id, body));
    } catch (error) {
      if (error instanceof Error && error.name === 'SourceNameConflictError')
        throw new ConflictException(error.message);
      throw new BadRequestException(
        error instanceof Error ? error.message : '来源配置无效',
      );
    }
  }

  /** 列出来源实例。 */
  @Get()
  @RequirePermission(PERMISSION.source.configure.code)
  @ApiOperation({ summary: '来源实例列表' })
  @ApiOkResponse({ schema: toOpenApiSchema(sourceListResponseSchema) })
  async list(): Promise<{ items: SourceView[] }> {
    const items = await this.sources.list(50);
    return { items: items.map((item) => toSourceView(item)) };
  }

  /** 列出实例健康。 */
  @Get(':id/health')
  @RequirePermission(PERMISSION.source.configure.code)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '来源实例健康' })
  @ApiOkResponse({ schema: toOpenApiSchema(sourceHealthResponseSchema) })
  async healthOf(@Param('id') id: string): Promise<{
    items: Array<{
      entry: string;
      state: string;
      detail?: string;
      checkedAt: string;
    }>;
  }> {
    const items = await this.health.list(id);
    return {
      items: items.map((item) => ({
        entry: item.entry,
        state: item.state,
        ...(item.detail ? { detail: item.detail } : {}),
        checkedAt: item.checkedAt.toISOString(),
      })),
    };
  }

  /** 启用实例。 */
  @Post(':id/enable')
  @HttpCode(200)
  @RequirePermission(PERMISSION.source.configure.code)
  @Audit('source.enable')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '启用来源实例' })
  @ApiOkResponse({ schema: toOpenApiSchema(sourceViewSchema) })
  async enable(@Param('id') id: string): Promise<SourceView> {
    return toSourceView(await this.sources.setEnabled(id, true));
  }

  /** 停用实例。 */
  @Post(':id/disable')
  @HttpCode(200)
  @RequirePermission(PERMISSION.source.configure.code)
  @Audit('source.disable')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '停用来源实例' })
  @ApiOkResponse({ description: '来源实例' })
  async disable(@Param('id') id: string): Promise<SourceView> {
    return toSourceView(await this.sources.setEnabled(id, false));
  }
}
