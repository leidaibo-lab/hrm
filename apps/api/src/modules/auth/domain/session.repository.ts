/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

/**
 * 会话存取端口：实现见 infrastructure/session.redis.repository。
 * 端口契约（实现必须遵守）：
 * - 单设备互踢（ADR-0010）：create 时踢出该账号既有会话，每账号仅一个有效会话；
 * - 会话内容最小化（仅 userId），权限集合每次请求实时展开，不做会话内缓存。
 */
export interface SessionRepository {
  /** 建立会话并踢出该账号的既有会话，被踢设备下一请求即 401；返回新 sid。 */
  create(userId: string): Promise<string>;
  /** 解析会话；会话不存在或载荷非法返回 null。 */
  resolve(sid: string): Promise<{ userId: string } | null>;
  /** 撤销会话；仅当其仍是该账号的活跃会话时清除反向索引（防互踢旧会话误删新会话索引）。 */
  revoke(sid: string): Promise<void>;
}
