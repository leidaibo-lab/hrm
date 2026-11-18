/** model-provider 域 queryKey 工厂：[域, 资源, 参数对象]。表格托管键为 [table-view, 表格 id, …]，由 TableView 内聚。 */
export const mpKeys = {
  /** 非表格服务商列表键（命令面板、CSV 导出）；整族失效用 providersListRoot。 */
  providersList: (q: string, all: boolean) =>
    ['mp-providers-list', q, all] as const,
  providersListRoot: ['mp-providers-list'] as const,
  provider: (id: string) =>
    ['model-provider', 'providers', 'detail', id] as const,
  /** 服务商详情整族前缀，用于导入、级联变更后的整域失效。 */
  providerRoot: ['model-provider', 'providers'] as const,
  /** 非表格模型列表键（报表模型映射、导入目录）；整族失效用 modelsListRoot。 */
  modelsList: (providerId: string, all: boolean) =>
    ['mp-models-list', providerId, all] as const,
  modelsListRoot: ['mp-models-list'] as const,
  model: (id: string) => ['model-provider', 'model', id] as const,
  /** 模型详情整族前缀，用于新增/删除后无法定位单一 id 的整域失效。 */
  modelRoot: ['model-provider', 'model'] as const,
  pricings: (modelId: string) =>
    ['model-provider', 'pricings', { modelId }] as const,
  catalog: ['model-provider', 'catalog'] as const,
};
