import { PERMISSION } from '@cip/shared';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
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
import { PolicyService } from './application/policy.service';
import {
  type AdmissionRuleView,
  type PolicyView,
  toAdmissionRuleView,
  toPolicyView,
} from './application/policy-view.service';
import {
  type PublishAdmissionRulesRequest,
  type PublishPolicyRequest,
  publishAdmissionRulesSchema,
  publishPolicySchema,
} from './dto/policy.dto';
import {
  admissionRuleListResponseSchema,
  currentPolicyResponseSchema,
  policyViewSchema,
} from './dto/policy-view.dto';

/** 策略入口：当前版本、发布新版本与准入表。 */
@ApiTags('agentic')
@Controller('agentic/policies')
export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  /** 当前策略；没有返回 null。 */
  @Get('current')
  @RequirePermission(PERMISSION.policy.configure.code)
  @ApiOperation({ summary: '当前策略' })
  @ApiOkResponse({ schema: toOpenApiSchema(currentPolicyResponseSchema) })
  async current(): Promise<{ policy?: PolicyView }> {
    const policy = await this.policies.current();
    return policy ? { policy: toPolicyView(policy) } : {};
  }

  /** 发布新策略版本。 */
  @Post()
  @HttpCode(200)
  @RequirePermission(PERMISSION.policy.configure.code)
  @Audit('policy.publish')
  @ApiBody({ schema: toOpenApiSchema(publishPolicySchema) })
  @ApiOperation({ summary: '发布策略版本' })
  @ApiOkResponse({ schema: toOpenApiSchema(policyViewSchema) })
  async publish(
    @Body(new ZodValidationPipe(publishPolicySchema))
    body: PublishPolicyRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PolicyView> {
    const policy = await this.policies.publish({
      acceptMode: body.acceptMode,
      rules: body.rules,
      createdBy: user.id,
    });
    return toPolicyView(policy);
  }

  /** 读取策略版本准入表。 */
  @Get(':id/admission-rules')
  @RequirePermission(PERMISSION.policy.configure.code)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: '策略准入表' })
  @ApiOkResponse({ schema: toOpenApiSchema(admissionRuleListResponseSchema) })
  async admissionRules(
    @Param('id') id: string,
  ): Promise<{ items: AdmissionRuleView[] }> {
    const rules = await this.policies.admissionRules(id);
    return { items: rules.map((rule) => toAdmissionRuleView(rule)) };
  }

  /** 为策略版本发布准入表。 */
  @Post(':id/admission-rules')
  @HttpCode(200)
  @RequirePermission(PERMISSION.policy.configure.code)
  @Audit('policy.publish_admission')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: toOpenApiSchema(publishAdmissionRulesSchema) })
  @ApiOperation({ summary: '发布准入规则' })
  @ApiOkResponse({ schema: toOpenApiSchema(admissionRuleListResponseSchema) })
  async publishAdmissionRules(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(publishAdmissionRulesSchema))
    body: PublishAdmissionRulesRequest,
  ): Promise<{ items: AdmissionRuleView[] }> {
    const rules = await this.policies.publishAdmissionRules(id, body.rules);
    return { items: rules.map((rule) => toAdmissionRuleView(rule)) };
  }
}
