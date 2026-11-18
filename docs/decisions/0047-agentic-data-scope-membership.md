# ADR-0047 agentic 数据范围成员与行级过滤

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

为关闭 `security.md` 行级过滤验收缺口（§16.10 #1，唯一 P0），在 agentic 域新增数据范围成员模型，并在工单/线程读取路径强制过滤。

- **数据模型**：新增 `agentic_scope_memberships`（`userId + scopeKey` 唯一，关联平台用户级联删除），作为「用户可访问项目/空间」的唯一事实源；V0 表数由 20 调整为 21。
- **判定**：`ScopeAccessService.allowedScopeKeys(actor)`：平台管理员（权限含 `*`）返回 `null` 表示不受限；其余用户返回成员关系中的 `scopeKey` 列表。`scopeKey` 为空的资源视为未分项目，对所有通过权限点的用户可见；其他跨项目资源不可见。
- **执行点**：工单列表/详情、线程列表/详情按允许集合过滤；越界详情统一返回 404（不泄漏存在性）。审计列表暂保留权限点控制，待审计记录补 scope 字段后同口径过滤。
- **管理**：`ScopeAccessService.grant/revoke/listMembers` 提供成员关系增删查；HTTP 端点 `GET/POST/DELETE /agentic/scopes/:scopeKey/members` 已上线，V0 借用 `policy:configure` 权限并写 `scope.member.grant/revoke` 审计；因此变更的 `permission-matrix.snap` 与端点审计清单按本 ADR 更新 protected 基线。

## 被否决的选项

- **只按请求参数 scopeKey 过滤**：调用方可任意传参，等于没有隔离。
- **把成员关系放进平台 IAM 通用表**：V0 平台尚无项目/空间模型，先把范围收敛在 agentic；平台化需单独 ADR。
- **在控制器逐接口手写判断**：重复且易漏，统一经 `ScopeAccessService`。
- **越界返回 403**：会泄漏资源存在性，统一 404。

## 后果与回滚

- 没有成员关系的普通用户只能看到 `scopeKey` 为空或已授权的资源；上线前需为现有用户补成员关系，否则列表会变空。
- 新增表与迁移 `20261116154000_scope_membership`；回滚删除表与 `ScopeAccessService` 过滤调用，恢复按权限点读取。
- 审计与 Attention 列表的行级过滤尚未覆盖，已在 `index.md` §16.10 #1 标注为后续增量。
