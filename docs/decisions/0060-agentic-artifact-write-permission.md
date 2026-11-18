# ADR-0060 agentic 产物写入权限点消费

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

消除 `artifact:write` 僵尸权限点，明确两类写入主体的语义：

- **内部执行器**：`/internal/artifacts` 仍用共享令牌，但 `EffectivePermissionService.checkInternal('artifacts:write')` 的必填权限点改为 `artifact:write`，令牌能力集同时包含该点；拒绝原因仍走 `permission_denied`。运行/回报动作继续要求 `agentic:internal`。
- **人工写入**：`POST /agentic/tickets/:id/artifacts/restore` 从 `ticket:update` 改为只要求 `artifact:write`；`POST /agentic/tickets/:id/writeback/revoke` 同时要求 `ticket:decide` 与 `artifact:write`（既做决定又追加产物版本）。
- 权限矩阵快照按 ADR 显式更新基线；不新增权限点。

## 被否决的选项

- **给内部令牌另造一套权限点**：会与平台权限目录分叉，审计无法按同一 `code` 判断。
- **把 restore 继续留在 `ticket:update`**：该点语义是状态流转，不覆盖产物版本写。
- **revoke 只保留 decide**：撤销回填会追加新产物版本，漏掉产物写权限。

## 验证

2026-11-16：新增 `effective-permission.service.spec`，断言写产物动作用 `artifact:write`、内部令牌在范围内允许；权限矩阵快照显示 `artifact:write` 由 3 个端点消费；API 全量单测、typecheck、lint、docs/rules 检查通过。未用真实 IAM 角色做越权联调。

## 后果与回滚

- 只被授予 `ticket:update` 的角色不能再回滚产物，需要补授 `artifact:write`；这是有意的权限收紧。
- 内部令牌能力未变（仍为 `artifacts:write`），只是必填平台权限点更明确。
- 回滚：恢复 controller 装饰器与 `requiredPermissionFor` 映射，并回退权限矩阵基线。
