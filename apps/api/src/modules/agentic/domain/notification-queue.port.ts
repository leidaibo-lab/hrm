import { AGENTIC_QUEUE } from '@cip/shared';

/** 通知队列名。 */
export const NOTIFICATION_QUEUE_NAME = AGENTIC_QUEUE.notification;

/** 通知任务的 DI 令牌。 */
export const NOTIFICATION_QUEUE = Symbol('NOTIFICATION_QUEUE');

/** 字段写回目标：飞书多维表格记录。 */
export interface NotificationBitable {
  /** 多维表格 app_token。 */
  appToken: string;
  /** 数据表 table_id。 */
  tableId: string;
  /** 记录 record_id。 */
  recordId: string;
  /** 字段名 → 值。 */
  fields: Record<string, unknown>;
}

/** 通知任务负载：文本消息或字段写回。 */
export interface NotificationJob {
  /** 来源实例主键。 */
  instanceId: string;
  /** 会话标识（文本消息必填）。 */
  chatId?: string;
  /** 文本内容（文本消息必填）。 */
  text?: string;
  /** 字段写回目标。 */
  bitable?: NotificationBitable;
  /** 关联工单主键；用于出站失败时回落到负责人关注。 */
  ticketId?: string;
  /** 幂等键。 */
  idempotencyKey: string;
}

/** 通知队列端口：闸门结果回到来源线程。 */
export interface NotificationQueuePort {
  /** 投递通知任务。 */
  enqueue(job: NotificationJob): Promise<void>;
}
