'use client';

import { useRecentUsageQuery, useUsageSummaryQuery } from '../api/queries';

/** 用量与成本只读视图：汇总 + 最近 20 次尝试。 */
export function UsagesPanel() {
  const summary = useUsageSummaryQuery();
  const recent = useRecentUsageQuery();

  if (summary.isPending || recent.isPending)
    return <p className="text-muted-foreground">加载中…</p>;
  if (summary.error)
    return <p className="text-destructive">{summary.error.message}</p>;
  if (recent.error)
    return <p className="text-destructive">{recent.error.message}</p>;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="调用次数" value={summary.data?.totalCalls ?? 0} />
        <SummaryCard label="成功" value={summary.data?.successCount ?? 0} />
        <SummaryCard label="失败" value={summary.data?.failedCount ?? 0} />
        <SummaryCard
          label="成本（USD）"
          value={summary.data?.totalCost ?? '缺失'}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">逻辑模型</th>
              <th className="px-4 py-3 font-medium">候选</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">tokens（入/出）</th>
              <th className="px-4 py-3 font-medium">成本</th>
            </tr>
          </thead>
          <tbody>
            {(recent.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">{row.modelName}</td>
                <td className="px-4 py-3 font-mono">{row.candidateId}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3 font-mono">
                  {row.inputTokens} / {row.outputTokens}
                </td>
                <td className="px-4 py-3">{row.cost ?? '缺失'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
