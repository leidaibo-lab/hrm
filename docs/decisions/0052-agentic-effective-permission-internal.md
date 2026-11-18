# ADR-0052 有效权限公式用于内部服务令牌

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

实现 `security.md` 的有效权限公式（能力 ∩ 触发人权限 ∩ 资源范围 ∩ 时间窗），先在内部执行器链路上落地：

- **公式**：`domain/effective-permission.entity.ts` 的 `checkEffectivePermission`，任一条件不满足即拒绝并返回可审计原因（`capability_denied` / `permission_denied` / `scope_denied` / 时间窗原因）。
- **内部令牌**：`EffectivePermissionService.checkInternal` 以服务令牌能力（`runs:start|reports:append|artifacts:write`）∩ 服务权限（`agentic:internal`）∩ `INTERNAL_API_SCOPES`（项目范围，`*` 不限）。
- **接入**：`POST /internal/runs|reports|artifacts` 在写库前校验工单范围；拒绝写 `internal.authz.deny` 审计并返回 403。
- **兼容**：`INTERNAL_API_SCOPES` 缺省 `*`，现有部署不受影响；收紧时才按项目范围过滤。
- **未覆盖**：人类触发人的工具级权限（缺 actor→工具权限解析）与策略时间窗仍待接。

## 被否决的选项

- **只做纯函数不接线**：无法满足「低权限触发人调用高权限工具被拒绝」；先接机器链路形成闭环。
- **在 InternalTokenGuard 里做范围判断**：guard 只有 token，不知道工单范围；放用例层可拿到资源。
- **新增独立权限点**：服务间调用统一用 `agentic:internal`，无需扩充目录。

## 后果与回滚

- 内部写入越界从「静默成功」变为 403 + 审计；`INTERNAL_API_SCOPES` 配置错误会拒绝执行器写入，需在部署检查中验证。
- 回滚：删除校验调用、`INTERNAL_API_SCOPES` 配置与 ADR；无数据迁移。
