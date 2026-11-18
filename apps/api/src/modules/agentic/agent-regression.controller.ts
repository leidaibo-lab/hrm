import { PERMISSION } from '@cip/shared';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  ServiceUnavailableException,
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
import {
  type AgentRegressionReport,
  AgentRegressionService,
  AgentRegressionUnavailableError,
  AgentRegressionUnsupportedError,
} from './application/agent-regression.service';
import {
  type RunAgentRegressionRequest,
  runAgentRegressionSchema,
} from './dto/agent-regression.dto';

/** Agent 回归入口：人工/CI 运行，不绑定版本发布。 */
@ApiTags('agentic')
@Controller('agentic/agents')
export class AgentRegressionController {
  constructor(private readonly regression: AgentRegressionService) {}

  /** 运行角色回归；发布前人工执行，不自动改状态。 */
  @Post(':key/regression')
  @HttpCode(200)
  @RequirePermission(PERMISSION.agent.configure.code)
  @Audit('agent.regression')
  @ApiParam({ name: 'key', type: String })
  @ApiBody({ schema: toOpenApiSchema(runAgentRegressionSchema) })
  @ApiOperation({ summary: '运行 Agent 回归' })
  @ApiOkResponse({ description: '回归分数与用例明细' })
  async run(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(runAgentRegressionSchema))
    body: RunAgentRegressionRequest,
  ): Promise<AgentRegressionReport> {
    try {
      return await this.regression.run(key, body.threshold);
    } catch (error) {
      if (error instanceof AgentRegressionUnsupportedError)
        throw new BadRequestException(error.message);
      if (error instanceof AgentRegressionUnavailableError)
        throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
}
