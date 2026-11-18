'use client';

import { useProvidersQuery } from '../api/queries';

/** 供应商只读列表：健康、启停与接入点。 */
export function ProvidersPanel() {
  const { data, error, isPending } = useProvidersQuery();

  if (isPending) return <p className="text-muted-foreground">加载中…</p>;
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data || data.length === 0)
    return <p className="text-muted-foreground">尚未接入供应商。</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">名称</th>
            <th className="px-4 py-3 font-medium">slug</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">健康</th>
            <th className="px-4 py-3 font-medium">接入点</th>
          </tr>
        </thead>
        <tbody>
          {data.map((provider) => (
            <tr key={provider.id} className="border-t border-border">
              <td className="px-4 py-3">{provider.name}</td>
              <td className="px-4 py-3 font-mono">{provider.slug}</td>
              <td className="px-4 py-3">
                {provider.enabled ? '启用' : '停用'}
              </td>
              <td className="px-4 py-3">{provider.health}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {provider.baseUrl}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
