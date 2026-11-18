import type {
  AuditControllerListResponses,
  AuditControllerReplayResponses,
  PolicyControllerAdmissionRulesResponses,
  PolicyControllerCurrentResponses,
  SourceAuthorizationControllerListResponses,
  SourceControllerHealthOfResponses,
  SourceControllerListResponses,
} from '@/lib/api-client';

/** 来源实例视图。 */
export type SourceView = SourceControllerListResponses[200]['items'][number];
/** 来源健康视图。 */
export type SourceHealthView =
  SourceControllerHealthOfResponses[200]['items'][number];
/** 策略视图。 */
export type PolicyView = NonNullable<
  PolicyControllerCurrentResponses[200]['policy']
>;
/** 准入规则视图。 */
export type AdmissionRuleView =
  PolicyControllerAdmissionRulesResponses[200]['items'][number];
/** 审计记录视图。 */
export type AuditView = AuditControllerListResponses[200]['items'][number];

/** 来源授权视图。 */
export type SourceAuthorizationView =
  SourceAuthorizationControllerListResponses[200]['items'][number];
/** 运行级 trace 视图。 */
export type TraceRunView = AuditControllerReplayResponses[200]['runs'][number];
