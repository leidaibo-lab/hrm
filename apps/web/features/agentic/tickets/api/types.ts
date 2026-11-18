import type {
  TicketControllerDetailResponses,
  TicketControllerListResponses,
  TicketControllerTimelineForTicketResponses,
} from '@/lib/api-client';

/** 工单视图：来自生成 client 的响应契约。 */
export type TicketView = TicketControllerListResponses[200]['items'][number];
/** 工单详情视图。 */
export type TicketDetailView = TicketControllerDetailResponses[200];
/** 关注视图。 */
export type AttentionView = TicketDetailView['attentions'][number];
/** 授权视图。 */
export type MandateView = NonNullable<TicketDetailView['mandate']>;
/** 产物视图。 */
export type ArtifactView = TicketDetailView['artifacts'][number];
/** 派发视图。 */
export type AssignmentView = TicketDetailView['assignments'][number];
/** 工单列表响应。 */
export type TicketListResponse = TicketControllerListResponses[200];
/** 工单轨迹视图。 */
export type TicketTimelineView =
  TicketControllerTimelineForTicketResponses[200];
/** 轨迹事件视图。 */
export type TimelineEventView = TicketTimelineView['events'][number];
