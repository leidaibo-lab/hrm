import type { Policy } from './policy.entity';

/** 策略仓储的 DI 令牌。 */
export const POLICY_REPOSITORY = Symbol('POLICY_REPOSITORY');

/** 策略仓储端口：版本只增不改。 */
export interface PolicyRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Policy | null>;
  /** 取当前生效版本（版本号最大）；无策略返回 null。 */
  findCurrent(): Promise<Policy | null>;
  /** 按版本号查找；不存在返回 null。 */
  findByVersion(version: number): Promise<Policy | null>;
  /** 创建新版本。 */
  create(policy: Policy): Promise<void>;
}
