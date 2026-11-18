import type { Report } from './report.entity';

/** 回报仓储的 DI 令牌。 */
export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');

/** 回报仓储端口：只追加。 */
export interface ReportRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Report | null>;
  /** 列出派发的回报，按创建时间升序。 */
  listByAssignment(assignmentId: string): Promise<Report[]>;
  /** 追加回报。 */
  create(report: Report): Promise<void>;
}
