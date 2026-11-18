import type { Mandate } from './mandate.entity';

/** 授权仓储的 DI 令牌。 */
export const MANDATE_REPOSITORY = Symbol('MANDATE_REPOSITORY');

/** 授权仓储端口：授权只增不改。 */
export interface MandateRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Mandate | null>;
  /** 创建授权；已存在同主键时由数据库拒绝。 */
  create(mandate: Mandate): Promise<void>;
}
