import type {
  ThreadControllerDetailResponses,
  ThreadControllerListResponses,
} from '@/lib/api-client';

/** 线程视图。 */
export type ThreadView = ThreadControllerListResponses[200]['items'][number];
/** 线程详情视图。 */
export type ThreadDetailView = ThreadControllerDetailResponses[200];
/** 事件视图。 */
export type TriggerView = ThreadDetailView['triggers'][number];
/** 冲突视图。 */
export type ConflictView = ThreadDetailView['conflicts'][number];
/** 线程列表响应。 */
export type ThreadListResponse = ThreadControllerListResponses[200];
