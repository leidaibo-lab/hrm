# ADR-0049 agentic 内部运行契约与共享令牌鉴权

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

落地 `index.md` §16.3 的内部契约，并让 Assignment/Report 生命周期可达。

- **鉴权**：新增 `INTERNAL_API_TOKEN`（共享令牌），请求头 `x-internal-token`；未配置时内部接口返回 503（视为未启用），错误令牌返回 401，比较前先 SHA-256 摘要以定长比较。生产环境缺失令牌启动失败。内部端点标记 `@Public` 以绕过会话鉴权，由 `InternalTokenGuard` 独立校验；端点审计的公开路由白名单按本 ADR 登记。
- **契约**：`POST /internal/runs`（按 ticketId 创建/复用派发，pending 时以 executorRunId 启动）、`POST /internal/reports`（追加 progress/waiting/ready/blocked/failed；终止性回报结束派发）、`POST /internal/artifacts`（写产物并绑定 assignmentId）。
- **写路径**：分别经 `InternalRuntimeService`、`AssignmentService`、`ReportRepository`、`ArtifactService`，每次写操作落 `audit_logs`（action `internal.run.start` / `internal.report.append` / `internal.artifact.write`，actorId 为空）。
- **检查设施**：端点审计的 controller 清单、权限矩阵快照与公开路由白名单变更，按本 ADR 更新 protected 基线。

## 被否决的选项

- **内部接口不加鉴权**：会暴露跨项目写入能力。
- **复用用户会话鉴权**：执行器没有用户会话，语义不匹配。
- **每个内部端点单独定义令牌**：V0 单一执行器平面，共享令牌足够；多执行器再拆。
- **直接让执行器写数据库**：绕过领域不变量与审计，固定为契约入口。

## 后果与回滚

- 部署需注入 `INTERNAL_API_TOKEN`；执行器多副本共用同一令牌，轮换需同时更新两侧。
- 运行与回报链路可达后，Assignment `pending→running→ended` 与 `agentic_reports` 有真实写入方；Ticket 结束仍由人工/闸门决定，不由报告自动结束（PRD「最终报告能结束 Ticket」的自动化待后续确认）。
- 回滚：移除 InternalController/Guard/路由白名单与 env，恢复端点审计基线；已写入的 assignment/report/artifact 保留。
