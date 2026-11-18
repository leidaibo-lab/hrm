import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ModelProvidersModule } from '../model-providers/model-providers.module';
import { AgentRegressionController } from './agent-regression.controller';
import { AcceptanceService } from './application/acceptance.service';
import { AdmissionService } from './application/admission.service';
import { AgentRegressionService } from './application/agent-regression.service';
import { ArtifactService } from './application/artifact.service';
import { AssignmentService } from './application/assignment.service';
import { AttentionService } from './application/attention.service';
import { AttentionReminderService } from './application/attention-reminder.service';
import { AuditRecordService } from './application/audit-record.service';
import { BreakdownService } from './application/breakdown.service';
import { ClarificationService } from './application/clarification.service';
import { EffectService } from './application/effect.service';
import { EffectivePermissionService } from './application/effective-permission.service';
import { EvalService } from './application/eval.service';
import { GateService } from './application/gate.service';
import { IngestionService } from './application/ingestion.service';
import { InternalRuntimeService } from './application/internal-runtime.service';
import { MetricsQueryService } from './application/metrics-query.service';
import { PolicyService } from './application/policy.service';
import { RecallService } from './application/recall.service';
import { RetentionService } from './application/retention.service';
import { RouterService } from './application/router.service';
import { RoutingService } from './application/routing.service';
import { RoutingRolloutService } from './application/routing-rollout.service';
import { RunFailureService } from './application/run-failure.service';
import { ScopeAccessService } from './application/scope-access.service';
import { StaleTicketService } from './application/stale-ticket.service';
import { SubscriptionService } from './application/subscription.service';
import { ThreadService } from './application/thread.service';
import { ThreadNotifierService } from './application/thread-notifier.service';
import { TicketService } from './application/ticket.service';
import { TimelineService } from './application/timeline.service';
import { WritebackService } from './application/writeback.service';
import { AttentionController } from './attention.controller';
import { AuditController } from './audit.controller';
import { ACCEPTANCE_REPOSITORY } from './domain/acceptance.repository';
import { ACTOR_PERMISSION_PORT } from './domain/actor-permission.port';
import { ADMISSION_RULE_REPOSITORY } from './domain/admission-rule.repository';
import { AGENT_REGRESSION_PORT } from './domain/agent-regression.port';
import { ARTIFACT_REPOSITORY } from './domain/artifact.repository';
import { ASSESSMENT_PORT } from './domain/assessment.port';
import { ASSIGNMENT_REPOSITORY } from './domain/assignment.repository';
import { ATTENTION_REPOSITORY } from './domain/attention.repository';
import { AUDIT_RECORD_REPOSITORY } from './domain/audit-record.repository';
import { BREAKDOWN_PORT } from './domain/breakdown.port';
import { BREAKDOWN_QUEUE } from './domain/breakdown-queue.port';
import { CLARIFICATION_PORT } from './domain/clarification.port';
import { CLARIFICATION_QUEUE } from './domain/clarification-queue.port';
import { DECISION_REPOSITORY } from './domain/decision.repository';
import { EFFECT_REPOSITORY } from './domain/effect.repository';
import { EVAL_LOCK } from './domain/eval-lock.port';
import { MANDATE_REPOSITORY } from './domain/mandate.repository';
import { NOTIFICATION_QUEUE } from './domain/notification-queue.port';
import { POLICY_REPOSITORY } from './domain/policy.repository';
import { RECALL_PORT } from './domain/recall.port';
import { REPORT_REPOSITORY } from './domain/report.repository';
import { RETENTION_REPOSITORY } from './domain/retention.repository';
import { ROUTER_DECISION_PORT } from './domain/router-decision.port';
import { SCOPE_MEMBERSHIP_REPOSITORY } from './domain/scope-membership.repository';
import { SEMANTIC_RECALL } from './domain/semantic-recall.port';
import { SUBSCRIPTION_REPOSITORY } from './domain/subscription.repository';
import { THREAD_REPOSITORY } from './domain/thread.repository';
import { TICKET_REPOSITORY } from './domain/ticket.repository';
import { TICKET_LOCK } from './domain/ticket-lock.port';
import { TOOL_ACCESS } from './domain/tool-access.port';
import { TRIGGER_REPOSITORY } from './domain/trigger.repository';
import { AcceptancePrismaRepository } from './infrastructure/acceptance.prisma.repository';
import { AdmissionRulePrismaRepository } from './infrastructure/admission-rule.prisma.repository';
import { ArtifactPrismaRepository } from './infrastructure/artifact.prisma.repository';
import { AssignmentPrismaRepository } from './infrastructure/assignment.prisma.repository';
import { AttentionPrismaRepository } from './infrastructure/attention.prisma.repository';
import { AuditRecordPrismaRepository } from './infrastructure/audit-record.prisma.repository';
import { BreakdownQueueService } from './infrastructure/breakdown-queue.service';
import { ClarificationQueueService } from './infrastructure/clarification-queue.service';
import { DecisionPrismaRepository } from './infrastructure/decision.prisma.repository';
import { EffectPrismaRepository } from './infrastructure/effect.prisma.repository';
import { EvalRedisLockService } from './infrastructure/eval-redis-lock.service';
import { IamActorPermissionService } from './infrastructure/iam-actor-permission.service';
import { MandatePrismaRepository } from './infrastructure/mandate.prisma.repository';
import { NotificationQueueService } from './infrastructure/notification-queue.service';
import { PolicyPrismaRepository } from './infrastructure/policy.prisma.repository';
import { ReportPrismaRepository } from './infrastructure/report.prisma.repository';
import { RetentionPrismaRepository } from './infrastructure/retention.prisma.repository';
import { MastraAssessmentService } from './infrastructure/runtime/assessment.service';
import { MastraBreakdownService } from './infrastructure/runtime/breakdown.service';
import { MastraClarificationService } from './infrastructure/runtime/clarification.service';
import { MastraAgentRegressionService } from './infrastructure/runtime/mastra-agent-regression.service';
import { MastraRouterDecisionService } from './infrastructure/runtime/router-decision.service';
import { MastraSemanticRecallService } from './infrastructure/runtime/semantic-recall.service';
import { ScopeMembershipPrismaRepository } from './infrastructure/scope-membership.prisma.repository';
import { SubscriptionPrismaRepository } from './infrastructure/subscription.prisma.repository';
import { ThreadPrismaRepository } from './infrastructure/thread.prisma.repository';
import { TicketPrismaRepository } from './infrastructure/ticket.prisma.repository';
import { TicketRedisLockService } from './infrastructure/ticket-redis-lock.service';
import { ToolAccessService } from './infrastructure/tool-access.service';
import { TriggerPrismaRepository } from './infrastructure/trigger.prisma.repository';
import { InternalController } from './internal.controller';
import { InternalMetricsController } from './internal-metrics.controller';
import { InternalRetentionController } from './internal-retention.controller';
import { PolicyController } from './policy.controller';
import { ScopeController } from './scope.controller';
import { ThreadController } from './thread.controller';
import { TicketController } from './ticket.controller';

/**
 * agentic 域模块：任务托管（线程、工单、授权、关注）。
 * 当前落数据模型、线程与事件接入；研判、runtime 与 connector 随后接入。
 */
@Module({
  imports: [ModelProvidersModule, IamModule],
  controllers: [
    TicketController,
    AttentionController,
    ThreadController,
    AgentRegressionController,
    AuditController,
    ScopeController,
    InternalController,
    InternalMetricsController,
    InternalRetentionController,
    PolicyController,
  ],
  providers: [
    ThreadService,
    IngestionService,
    AdmissionService,
    AgentRegressionService,
    AuditRecordService,
    AcceptanceService,
    AttentionReminderService,
    AttentionService,
    AssignmentService,
    ArtifactService,
    BreakdownService,
    EffectService,
    GateService,
    PolicyService,
    StaleTicketService,
    SubscriptionService,
    ThreadNotifierService,
    WritebackService,
    TicketService,
    TimelineService,
    EvalService,
    RouterService,
    RoutingService,
    RunFailureService,
    RoutingRolloutService,
    ScopeAccessService,
    InternalRuntimeService,
    MetricsQueryService,
    EffectivePermissionService,
    RecallService,
    { provide: RECALL_PORT, useClass: RecallService },
    {
      provide: AGENT_REGRESSION_PORT,
      useClass: MastraAgentRegressionService,
    },
    {
      provide: ROUTER_DECISION_PORT,
      useClass: MastraRouterDecisionService,
    },
    RetentionService,
    ClarificationService,
    { provide: ASSESSMENT_PORT, useClass: MastraAssessmentService },
    { provide: CLARIFICATION_PORT, useClass: MastraClarificationService },
    { provide: BREAKDOWN_PORT, useClass: MastraBreakdownService },
    { provide: BREAKDOWN_QUEUE, useClass: BreakdownQueueService },
    { provide: CLARIFICATION_QUEUE, useClass: ClarificationQueueService },
    { provide: NOTIFICATION_QUEUE, useClass: NotificationQueueService },
    { provide: THREAD_REPOSITORY, useClass: ThreadPrismaRepository },
    { provide: TRIGGER_REPOSITORY, useClass: TriggerPrismaRepository },
    {
      provide: AUDIT_RECORD_REPOSITORY,
      useClass: AuditRecordPrismaRepository,
    },
    { provide: DECISION_REPOSITORY, useClass: DecisionPrismaRepository },
    { provide: MANDATE_REPOSITORY, useClass: MandatePrismaRepository },
    { provide: TICKET_REPOSITORY, useClass: TicketPrismaRepository },
    { provide: POLICY_REPOSITORY, useClass: PolicyPrismaRepository },
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: SubscriptionPrismaRepository,
    },
    {
      provide: ADMISSION_RULE_REPOSITORY,
      useClass: AdmissionRulePrismaRepository,
    },
    { provide: ACCEPTANCE_REPOSITORY, useClass: AcceptancePrismaRepository },
    { provide: ATTENTION_REPOSITORY, useClass: AttentionPrismaRepository },
    { provide: ARTIFACT_REPOSITORY, useClass: ArtifactPrismaRepository },
    { provide: REPORT_REPOSITORY, useClass: ReportPrismaRepository },
    { provide: EFFECT_REPOSITORY, useClass: EffectPrismaRepository },
    { provide: ASSIGNMENT_REPOSITORY, useClass: AssignmentPrismaRepository },
    { provide: EVAL_LOCK, useClass: EvalRedisLockService },
    { provide: ACTOR_PERMISSION_PORT, useClass: IamActorPermissionService },
    { provide: TOOL_ACCESS, useClass: ToolAccessService },
    {
      provide: SEMANTIC_RECALL,
      useClass: MastraSemanticRecallService,
    },
    { provide: RETENTION_REPOSITORY, useClass: RetentionPrismaRepository },
    { provide: TICKET_LOCK, useClass: TicketRedisLockService },
    {
      provide: SCOPE_MEMBERSHIP_REPOSITORY,
      useClass: ScopeMembershipPrismaRepository,
    },
  ],
  exports: [
    EffectService,
    PolicyService,
    ThreadService,
    RouterService,
    RoutingService,
    IngestionService,
    AdmissionService,
    AuditRecordService,
    AcceptanceService,
    AttentionService,
    AttentionReminderService,
    StaleTicketService,
    SubscriptionService,
    ThreadNotifierService,
    BreakdownService,
    ClarificationService,
    RunFailureService,
    RoutingRolloutService,
    ScopeAccessService,
    MetricsQueryService,
    TICKET_LOCK,
    THREAD_REPOSITORY,
    TRIGGER_REPOSITORY,
    TICKET_REPOSITORY,
    POLICY_REPOSITORY,
    MANDATE_REPOSITORY,
    ATTENTION_REPOSITORY,
    ARTIFACT_REPOSITORY,
  ],
})
export class AgenticModule {}
