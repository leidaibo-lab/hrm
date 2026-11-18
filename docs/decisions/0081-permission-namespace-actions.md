# ADR-0081 权限点命名空间与动作词收敛

> 状态：已接受 · 日期：2026-11-17 · 级别：L3

## 决定

权限点 code 统一为 `<domain>.<resource>:<action>`：

- `domain`：模块域名，取 `agentic` / `model` / `iam`；
- `resource`：领域内资源，kebab-case；
- `action`：只允许 `read` / `create` / `update` / `delete` / `manage`，不再新增 `decide` / `configure` / `write` 等域动词。

示例：

| 原 code                   | 新 code                       |
| ------------------------- | ----------------------------- |
| `ticket:read`             | `agentic.ticket:read`         |
| `ticket:decide`           | `agentic.attention:update`    |
| `ticket:update`           | `agentic.ticket:update`       |
| `artifact:write`          | `agentic.artifact:create`     |
| `source:configure`        | `agentic.source:update`       |
| `policy:configure`        | `agentic.policy:update`       |
| `agent:configure`         | `agentic.agent:update`        |
| `model-provider:manage`   | `model.gateway:manage`        |
| `user:manage`             | `iam.user:manage`             |
| `role:manage`             | `iam.role:manage`             |
| `navigation:manage`       | `iam.navigation:manage`       |
| `permission-point:manage` | `iam.permission-point:manage` |
| —（新增）                 | `iam.space:manage`            |

guard 仍按第一个冒号切分（domain.resource 为一段）；目录、导航、快照、端点审计与 PRD 同批更新；旧 code 标废弃不物理删除。

## 被否决的选项

- **保留域动词**：动作词无限扩张，权限矩阵无法收敛。
- **resource 保持裸名（`ticket:read`）**：跨模块重名无法归因，审计与目录冲突。

## 后果与回滚

- 权限目录、种子、快照与测试需迁移；旧 code 保留废弃行一个周期。
- 回滚：恢复旧 code 与动作词，撤销本 ADR 与迁移。
