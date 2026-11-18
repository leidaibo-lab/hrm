import { SetMetadata } from '@nestjs/common';

/** Audit 装饰器写入的反射元数据键，与 AuditInterceptor 约定一致。 */
export const AUDIT_ACTION_KEY = 'cip:audit:action';

/**
 * 标记需要审计的端点，全局 AuditInterceptor 据此决定是否落 audit 表。
 * @param action - 审计动作名，域前缀分节，如 "auth.login"、"agent.run"。
 */
export const Audit = (action: string): MethodDecorator =>
  SetMetadata(AUDIT_ACTION_KEY, action);
