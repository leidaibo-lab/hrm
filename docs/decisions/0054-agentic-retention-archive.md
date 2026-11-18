# ADR-0054 保留归档预检与显式删除

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

落地 `operations.md` §五的保留归档，默认只预检、不删除：

- **阈值**：Trigger 90 天、OutboundMessage 30 天、Report 180 天。
- **只清终态**：Trigger 仅 `filtered/evaluated/fanned_out`，Outbound 仅 `sent/gone`；pending 记录不删。
- **预检**：`GET /internal/retention` 返回阈值与过期计数，不修改数据。
- **删除**：`POST /internal/retention/apply` 需同时满足 `AGENTIC_RETENTION_APPLY=true` 与确认串 `DELETE_EXPIRED`；单事务删除，返回计数。
- **鉴权**：沿用内部共享令牌 `x-internal-token`（ADR-0049）。
- **检查设施**：新增两个内部端点，端点审计公开路由白名单/权限矩阵 snapshot 与 protected 基线按本 ADR 更新。

## 被否决的选项

- **默认开启删除**：删除不可逆，未经运营授权不可默认执行。
- **删除 pending 事件/出站**：可能丢未处理工作，排除。
- **定时任务自动删除**：V0 先由运维显式调用，保留可审计的人工确认点。

## 验证

2026-11-16 在隔离库（fresh migrate + 真实数据）执行：预检 `{triggers:1,outbound:1,reports:1}`、删除同计数；删除后 rest 为 `{triggers:1,outbound:1,reports:0}`，其中过期的 `pending` 事件/出站被保留。事务与级联未触发错误。

## 后果与回滚

- 删除是物理删除且不可恢复，需在隔离库验证后再用于生产；`AGENTIC_RETENTION_APPLY` 默认 false。
- 预检与删除均无 schema 变更；回滚删除端点与开关即可，已删数据不可恢复。
