# ADR-0036 TableView 测试基建与机检适配

> 状态：已接受 · 日期：2026-11-15 · 级别：L3

## 决定

落地 PRD-TABLEVIEW（`docs/prd/table-view.md`）所需的四项设施变更：

1. `apps/web` 新增组件测试 devDependencies（`jsdom`、`@testing-library/react`、`@testing-library/dom`、`@testing-library/user-event`）：PRD 16.8 要求 React 组件层行为测试（回调原因/次数、搜索 debounce/composition、选择锁定、动作部分失败、ref 句柄），现有 node 环境无法渲染组件。
2. `apps/web/vitest.config.mts` 增加 `@` → `apps/web` 解析别名（与 tsconfig paths 同源）：组件与切片统一以 `@/` 导入，测试环境需同等解析。
3. `scripts/checks/rules.ts` 的 web 文件名 kebab 正则豁免 `.spec.tsx` / `.test.tsx` 后缀段：TST-4.1（testing.md）明确允许 `<被测对象>.spec.ts(x)` 就近放置，机检此前未同步该规范，属检查缺陷修复而非放宽——对象名（`table-view`）仍须 kebab。
4. `apps/api/src/__tests__/__snapshots__/permission-matrix.snap` 事实更新：四个 GET 列表端点被各自的 `POST /query` 替代（users/roles/ai/providers/ai/usages），`ai/models` 新增 `POST /query`（`GET /ai/models` 保留给非表格能力筛选消费者）。权限点不变。

本批提交落地第 1–3 项；第 4 项随业务路由迁移另行提交，当前主线保留原端点及其权限矩阵快照。

## 被否决的选项

- 组件测试改用 Node 环境手写 DOM 桩：维护成本高且与 testing-library 生态背离。
- 测试文件迁出 `__tests__` 目录规避 kebab 规则：违反 TST-4.1 就近放置规范。
- 保留 GET 列表端点给权限矩阵快照：PRD 明确一次性迁移、不保留旧表格消费端点。

## 后果与回滚

`pnpm --filter @cip/web test` 收集并执行组件测试；`pnpm check:rules` 接受 `.spec.tsx`/`.test.tsx` 命名。回滚时还原 vitest.config.mts 与 rules.ts 正则、卸载四个 devDependencies、恢复权限矩阵快照，并回滚本 ADR。受保护基线按治理流程以本 ADR 决策号更新。
