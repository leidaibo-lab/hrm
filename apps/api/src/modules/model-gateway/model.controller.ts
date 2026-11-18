import { PERMISSION } from '@cip/shared';
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
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
import { ModelService } from './application/model.service';
import {
  type CandidateViewDto,
  type CreateCandidateDto,
  type CreateLogicalModelDto,
  candidateViewSchema,
  createCandidateSchema,
  createLogicalModelSchema,
  type LogicalModelViewDto,
  logicalModelViewSchema,
  type SetCandidateEnabledDto,
  type SetLogicalModelEnabledDto,
  setCandidateEnabledSchema,
  setLogicalModelEnabledSchema,
  type UpdateCandidateDto,
  type UpdateLogicalModelDto,
  updateCandidateSchema,
  updateLogicalModelSchema,
} from './dto/model.dto';

/** 逻辑模型与候选管理（/model-gateway/models、/model-gateway/candidates）。 */
@ApiTags('model-gateway-models')
@Controller('model-gateway')
export class ModelController {
  constructor(private readonly models: ModelService) {}

  @Get('models')
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(logicalModelViewSchema.array()) })
  @ApiOperation({ operationId: 'mgModel0', summary: '逻辑模型列表' })
  async list(): Promise<LogicalModelViewDto[]> {
    return logicalModelViewSchema
      .array()
      .parse(await this.models.listLogical());
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Get('models/:id')
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(logicalModelViewSchema) })
  @ApiOperation({ operationId: 'mgModel1', summary: '逻辑模型详情' })
  async get(@Param('id') id: string): Promise<LogicalModelViewDto> {
    return logicalModelViewSchema.parse(await this.models.getLogical(id));
  }

  @Post('models')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.create_model')
  @ApiBody({ schema: toOpenApiSchema(createLogicalModelSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(logicalModelViewSchema) })
  @ApiOperation({ operationId: 'mgModel2', summary: '创建逻辑模型' })
  async create(
    @Body(new ZodValidationPipe(createLogicalModelSchema))
    dto: CreateLogicalModelDto,
  ): Promise<LogicalModelViewDto> {
    return logicalModelViewSchema.parse(
      await this.models.createLogical({
        logicalKey: dto.logicalKey,
        displayName: dto.displayName,
        ...(dto.maxAttempts === undefined
          ? {}
          : { maxAttempts: dto.maxAttempts }),
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Patch('models/:id')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.update_model')
  @ApiBody({ schema: toOpenApiSchema(updateLogicalModelSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(logicalModelViewSchema) })
  @ApiOperation({ operationId: 'mgModel3', summary: '更新逻辑模型' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLogicalModelSchema))
    dto: UpdateLogicalModelDto,
  ): Promise<LogicalModelViewDto> {
    return logicalModelViewSchema.parse(
      await this.models.updateLogical(id, {
        ...(dto.displayName === undefined
          ? {}
          : { displayName: dto.displayName }),
        ...(dto.maxAttempts === undefined
          ? {}
          : { maxAttempts: dto.maxAttempts }),
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Put('models/:id/enabled')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.set_model_enabled')
  @ApiBody({ schema: toOpenApiSchema(setLogicalModelEnabledSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(logicalModelViewSchema) })
  @ApiOperation({ operationId: 'mgModel4', summary: '启停逻辑模型' })
  async setEnabled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setLogicalModelEnabledSchema))
    dto: SetLogicalModelEnabledDto,
  ): Promise<LogicalModelViewDto> {
    return logicalModelViewSchema.parse(
      await this.models.setLogicalEnabled(id, dto.enabled),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Get('models/:id/candidates')
  @RequirePermission(PERMISSION.modelGateway.read.code)
  @ApiOkResponse({ schema: toOpenApiSchema(candidateViewSchema.array()) })
  @ApiOperation({ operationId: 'mgModel5', summary: '逻辑模型候选列表' })
  async listCandidates(@Param('id') id: string): Promise<CandidateViewDto[]> {
    return candidateViewSchema
      .array()
      .parse(await this.models.listCandidates(id));
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Post('models/:id/candidates')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.create_candidate')
  @ApiBody({ schema: toOpenApiSchema(createCandidateSchema) })
  @ApiCreatedResponse({ schema: toOpenApiSchema(candidateViewSchema) })
  @ApiOperation({ operationId: 'mgModel6', summary: '为逻辑模型创建候选' })
  async createCandidate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createCandidateSchema))
    dto: CreateCandidateDto,
  ): Promise<CandidateViewDto> {
    return candidateViewSchema.parse(
      await this.models.createCandidate(id, {
        providerId: dto.providerId,
        providerModelId: dto.providerModelId,
        catalogModelId: dto.catalogModelId ?? null,
        priority: dto.priority,
        timeoutMs: dto.timeoutMs ?? null,
        capabilities: dto.capabilities,
        defaultParams: dto.defaultParams ?? null,
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Patch('candidates/:id')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.update_candidate')
  @ApiBody({ schema: toOpenApiSchema(updateCandidateSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(candidateViewSchema) })
  @ApiOperation({ operationId: 'mgModel7', summary: '更新候选' })
  async updateCandidate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCandidateSchema))
    dto: UpdateCandidateDto,
  ): Promise<CandidateViewDto> {
    return candidateViewSchema.parse(
      await this.models.updateCandidate(id, {
        ...(dto.providerModelId === undefined
          ? {}
          : { providerModelId: dto.providerModelId }),
        ...(dto.catalogModelId === undefined
          ? {}
          : { catalogModelId: dto.catalogModelId }),
        ...(dto.priority === undefined ? {} : { priority: dto.priority }),
        ...(dto.timeoutMs === undefined ? {} : { timeoutMs: dto.timeoutMs }),
        ...(dto.capabilities === undefined
          ? {}
          : { capabilities: dto.capabilities }),
        ...(dto.defaultParams === undefined
          ? {}
          : { defaultParams: dto.defaultParams }),
      }),
    );
  }

  @ApiParam({ name: 'id', type: String, required: true })
  @Put('candidates/:id/enabled')
  @RequirePermission(PERMISSION.modelGateway.manage.code)
  @Audit('model-gateway.set_candidate_enabled')
  @ApiBody({ schema: toOpenApiSchema(setCandidateEnabledSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(candidateViewSchema) })
  @ApiOperation({ operationId: 'mgModel8', summary: '启停候选' })
  async setCandidateEnabled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setCandidateEnabledSchema))
    dto: SetCandidateEnabledDto,
  ): Promise<CandidateViewDto> {
    return candidateViewSchema.parse(
      await this.models.setCandidateEnabled(id, dto.enabled),
    );
  }
}
