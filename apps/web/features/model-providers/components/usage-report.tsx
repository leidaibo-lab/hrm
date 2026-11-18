'use client';

import { ActivityIcon } from 'lucide-react';
import { useMemo } from 'react';
import {
  createColumns,
  createTableQuery,
  FilterOperator,
  option,
  type SemanticOption,
  SortDirection,
  TableView,
} from '@/components/table-view';
import { cn } from '@/lib/utils';
import { useModelsList } from '../api/models';
import type { UsageRow, UsageSummary } from '../api/usage';
import { queryUsageReport } from '../api/usage';

const STATUS_OPTIONS: Record<string, SemanticOption> = {
  success: option.success('成功'),
  failed: option.danger('失败'),
  rate_limited: option.warning('限流'),
};

/** 列工厂：modelId 开放值域枚举筛选、status 枚举筛选、caller 文本、createdAt 日期。 */
const usageColumns = (modelMap: Record<string, SemanticOption>) =>
  createColumns<UsageRow>(({ date, select, number, status, text }) => [
    date('createdAt', '时间', {
      format: 'HH:mm:ss',
      width: 150,
      filter: {
        operators: [FilterOperator.Before, FilterOperator.NotBefore],
        granularity: 'datetime',
      },
    }),
    select('modelId', '模型', modelMap, {
      width: 180,
      cell: (row) => (
        <div className="grid gap-0.5">
          <span className="truncate font-medium">{row.modelName}</span>
          <span className="truncate text-[length:var(--text-meta)] text-muted-foreground">
            {row.providerSlug}
          </span>
        </div>
      ),
      filter: {
        operators: [FilterOperator.Equal, FilterOperator.NotEqual],
        multiple: true,
      },
    }),
    {
      id: 'tokens',
      header: 'Tokens（入 / 出 / 缓存 / 推理）',
      width: 230,
      sortable: false,
      cell: (row) => (
        <span className="font-mono text-[length:var(--text-meta)] tabular-nums text-muted-foreground">
          {row.inputTokens} / {row.outputTokens} / {row.cachedInputTokens} /{' '}
          {row.reasoningTokens}
        </span>
      ),
    },
    number('cost', '成本', {
      width: 100,
      sortable: true,
      format: (value) => `$${value}`,
    }),
    number('latencyMs', '时延', {
      width: 90,
      sortable: true,
      format: (value) => `${value}ms`,
    }),
    status('status', '状态', STATUS_OPTIONS, {
      width: 90,
      resizable: false,
      filter: {
        operators: [FilterOperator.Equal, FilterOperator.NotEqual],
        multiple: true,
      },
    }),
    text('caller', '调用方', {
      width: 120,
      filter: {
        operators: [
          FilterOperator.Equal,
          FilterOperator.NotEqual,
          FilterOperator.Contains,
          FilterOperator.NotContains,
        ],
      },
    }),
  ]);

/** 用量报表：汇总经 renderMeta 读取同一 query cache 的 meta，明细表为计费事实源。 */
export function UsageReport({ identityKey }: { identityKey: string }) {
  const models = useModelsList(undefined, { enabled: true, all: true });

  const modelMap = useMemo(
    () =>
      Object.fromEntries(
        (models.data ?? []).map((model) => [
          model.id,
          { label: model.displayName, tone: 'neutral' as const },
        ]),
      ),
    [models.data],
  );
  const tableColumns = useMemo(() => usageColumns(modelMap), [modelMap]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col">
        <TableView<UsageRow, UsageSummary>
          id="usage-report"
          identityKey={identityKey}
          query={createTableQuery({ request: queryUsageReport })}
          columns={tableColumns}
          rowKey={(row) => row.id}
          title="全部调用"
          toolbar={{
            searchable: { placeholder: '搜索调用方…', debounceMs: 300 },
            filterable: true,
            sortable: { maxRules: 3 },
            columnSettings: true,
          }}
          defaultQuery={{
            pageSize: 20,
            sort: [{ field: 'createdAt', direction: SortDirection.Desc }],
          }}
          renderMeta={(summary, { fetching }) =>
            summary ? (
              <div className={cn(fetching && 'opacity-60 transition-opacity')}>
                <SummaryStrip summary={summary} />
                {!!(summary.totalCalls > 0) && (
                  <SuccessBar
                    success={summary.successCount}
                    failed={summary.failedCount}
                    limited={summary.rateLimitedCount}
                    total={summary.totalCalls}
                  />
                )}
              </div>
            ) : null
          }
          empty={{
            icon: ActivityIcon,
            title: '暂无调用记录',
            description: '模型调用经网关自动计量，此处按周期聚合展示。',
          }}
        />
      </div>
    </div>
  );
}

/** 汇总条：hairline 分隔的四格指标，数值用等宽数字。 */
function SummaryStrip({ summary }: { summary: UsageSummary }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border md:grid-cols-4',
        'border border-border',
      )}
    >
      <StatCell
        label="调用次数"
        value={summary.totalCalls.toLocaleString('zh-CN')}
        hint={`成功 ${summary.successCount.toLocaleString('zh-CN')} 次`}
      />
      <StatCell
        label="Tokens（入 / 出）"
        value={`${compact(summary.totalInputTokens)} / ${compact(summary.totalOutputTokens)}`}
        hint="输入 / 输出"
      />
      <StatCell
        label="总成本"
        value={
          summary.totalCost === null
            ? '未计价'
            : `$${Number(summary.totalCost)}`
        }
        hint="按计价规则累计"
      />
      <StatCell
        label="失败 / 限流"
        value={`${summary.failedCount} / ${summary.rateLimitedCount}`}
        hint="失败 / 限流次数"
      />
    </div>
  );
}

/** 单格指标：零容器，标签—数值—注释三档。 */
function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-[length:var(--text-meta)] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[length:var(--text-figure)] font-semibold tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[length:var(--text-meta)] text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

/** 调用构成条：成功率的 6px 信号条 + 等宽百分比。 */
function SuccessBar({
  success,
  failed,
  limited,
  total,
}: {
  success: number;
  failed: number;
  limited: number;
  total: number;
}) {
  const rate = (success / total) * 100;
  return (
    <div className="flex items-center gap-3 pt-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-success" style={{ width: `${rate}%` }} />
      </div>
      <span
        className={cn(
          'shrink-0 font-mono text-[length:var(--text-meta)] tabular-nums',
          'text-muted-foreground',
        )}
      >
        成功 {rate.toFixed(1)}%
      </span>
      <span className="shrink-0 text-[length:var(--text-meta)] text-muted-foreground">
        失败 {failed} · 限流 {limited} · 共 {total}
      </span>
    </div>
  );
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
