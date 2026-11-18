import type {
  AttentionControllerAnswerResponses,
  AttentionControllerListResponses,
} from '@/lib/api-client';

/** 关注视图。 */
export type AttentionView =
  AttentionControllerListResponses[200]['items'][number];
/** 关注列表响应。 */
export type AttentionListResponse = AttentionControllerListResponses[200];
/** 回答关注响应。 */
export type AttentionAnswerResponse = AttentionControllerAnswerResponses[200];
