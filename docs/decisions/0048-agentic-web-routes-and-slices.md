# ADR-0048 agentic Web 路由与切片迁移

> 状态：已接受 · 日期：2026-11-16 · 级别：L3
>
> 注：页面路由部分已被 ADR-0080 取代（2026-11-17）；切片与导航结构仍有效。

## 决定

按 `web.md` §4.1/§4.2 迁移 agentic Web 结构，关闭 §16.10 #13/#21 的规范漂移。

- **路由**：`/tickets`、`/threads`、`/attention` 保持；源/角色/策略/审计页面迁入 `/console/{sources,agents,policies,audit}`，`/console` 为运行轨迹；旧扁平路由不再保留。
- **切片**：`features/agentic/` 拆为 `tickets`、`threads`、`attention`、`console` 四个切片（`api/`、`components/`、`index.ts`），跨切片只经各自出口；共享类型与查询键放 `features/agentic/shared/`，域根目录不设 `index.ts`。
- **导航**：共享导航目录新增 `ferry.console`（`/console`，`audit:read`），`ferry.audit/agents/policies/sources` 路径改为 `/console/*`，节点 code 保持不变以减少权限映射变化。
- **检查设施**：导航引用变化会影响 `permission-matrix.snap`；按本 ADR 更新 protected 基线，权限矩阵本身语义不变。`scripts/checks/lib/source-graph.ts` 的 WEB-9.2 允许「一层切片出口」（`features/<域>/<切片>/index.ts`），仍拒绝更深层深导入。
- **hooks 目录**：V0 查询 hooks 仍在各切片 `api/` 内（TanStack Query 封装），`hooks/` 目录待确有可复用交互逻辑时再落文件，避免空壳目录。

## 被否决的选项

- **只修订文档承认扁平路由**：与 `web.md` 验收「路由/切片一致」冲突，且控制台类页面继续散落在根路由。
- **保留旧路由并新增 `/console*` 双入口**：形成两套真相源，权限与导航难以一致。
- **跨切片共享 `types.ts` 放域根**：违反「域目录不设出口/跨切片只经出口」，改为 `shared/` 且不导出根 barrel。
- **为迁移一次性重写所有页面组件**：迁移只做路径与归位，不改交互语义，降低回归面。

## 后果与回滚

- 页面 URL 变化，外部书签/旧链接失效；V0 内部无对外承诺，导航已同步。
- `features/agentic` 内部 import 路径变化，测试与生成 client 已同步；回滚按 Git 历史恢复路由与切片并重新生成导航快照。
