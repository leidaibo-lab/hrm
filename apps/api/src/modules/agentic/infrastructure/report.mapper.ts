import type { Report as ReportRow } from '../../../platform/prisma/generated/client';
import type { ReportKind } from '../domain/report.entity';
import { Report } from '../domain/report.entity';

/** Prisma 行 → 回报聚合；domain ← 持久化形态的唯一翻译点。 */
export function toReportDomain(row: ReportRow): Report {
  return Report.rehydrate({
    id: row.id,
    assignmentId: row.assignmentId,
    kind: row.kind as ReportKind,
    payload: row.payload,
    createdAt: row.createdAt,
  });
}
