import { Inject, Injectable } from '@nestjs/common';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../domain/session.repository';

/**
 * 会话应用服务：会话存取经端口编排（ADR-0014 标准分层，薄转发为统一性既定成本）。
 * 互踢策略、键设计与 payload 解析在 infrastructure 实现内（端口契约见 SessionRepository）。
 * SessionGuard 与 AuthService 均经本服务读取会话，会话存取全仓单源。
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  /**
   * 建立会话并踢出该账号的既有会话（单设备互踢）。
   * @param userId - 已认证用户 id。
   * @returns 新会话 id（写入 cookie 由 controller 负责）。
   */
  create(userId: string): Promise<string> {
    return this.sessions.create(userId);
  }

  /**
   * 解析会话。
   * @returns userId；会话不存在或载荷非法时为 null。
   */
  resolve(sid: string): Promise<{ userId: string } | null> {
    return this.sessions.resolve(sid);
  }

  /** 撤销会话（仅活跃会话清除反向索引，语义见端口契约）。 */
  revoke(sid: string): Promise<void> {
    return this.sessions.revoke(sid);
  }
}
