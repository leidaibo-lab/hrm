# ADR-0074 移除 AgentVersion 与版本发布门禁

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

移除 `AgentVersion` 表、API、运行时 fallback、prompt digest 发布门禁与 Web 管理页；保留 `Policy.version` 与 `Artifact.version`：

- 模型选择只来自策略 `mainModel` / `clarificationModel` / `assessmentModel`。
- 删除 `POST /agentic/agents`、`GET /agentic/agents`、`GET /agentic/agents/:key/versions`。
- 保留 `POST /agentic/agents/:key/regression`，改为手动/CI 运行；删除 `regressionRequired` 与 `assertPassing`。
- 删除 `/console/agents` 页面与导航节点。

## 原因

`AgentVersion` 只被读取为模型 fallback，运行、审计与 trace 都不记录具体版本；没有激活/回滚语义，`config` 无消费方，prompt 只存 digest，无法还原或回滚。它没有形成版本治理闭环，却增加了表、API、页面和发布门禁的维护面。

## 数据处置

- 当前处于开发阶段：代码移除与 `DROP TABLE "agentic_agent_versions"` 同批执行，不做 A/B 分批。
- 如开发库存在需要保留的历史数据，可先导出 CSV；无数据则直接 drop。
- 回滚：回退代码并重放历史迁移重建空表；旧模型路由由策略恢复。

## 验证

2026-11-16：删除后 API 单测、typecheck、lint、docs/rules/protected 通过；回归接口保留；版本端点从权限矩阵移除。真实生产数据归档与 drop 仍需部署窗口执行。

## 后果

- 内部管理端点破坏性下线；仓库内无外部消费者。
- 没有 Agent 版本回滚能力；模型切换只通过策略发布，审计记录策略版本而非 Agent 版本。
- prompt digest 不再在发布时校验；提示词变更依赖代码审查与回归测试。
