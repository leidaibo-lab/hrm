# ADR-0059 agentic 最终报告生命周期与执行端口

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

补齐 `domain.md`「只有最终报告能结束 Ticket」：

- **ready**：结束 Assignment 后自动结束 Ticket，结束原因取回报 `payload.summary`，缺省「执行器报告就绪」；工单已结束时幂等跳过。审计 `internal.ticket.end`。
- **blocked / failed**：结束 Assignment 但保持 Ticket 打开，经 `RunFailureService` 转人工 review 关注（24h 时限，已有未关闭 review 时不重复）；工单已结束则跳过。审计 `internal.ticket.handover`。
- **progress / waiting**：只追加回报，不改 Assignment 与 Ticket。
- **ExecutorPort**：新增 `domain/executor.port.ts`，固定 `run(input) → RuntimeReport` 契约与 `EXECUTOR_PORT` 令牌；当前 Mastra 执行仍经既有澄清/拆解适配器，端口实现随代码执行角色接入，application 侧不新增对具体运行时的依赖。

## 被否决的选项

- **ready 不结束 Ticket、全部等人确认**：与「最终报告能结束 Ticket」冲突，且会让已完成任务持续占用待办。
- **blocked/failed 直接关单**：会丢掉未完成工作与责任人，违反「超时/失败不静默」。
- **重复 open review 关注**：按工单已有 review 去重，避免同一失败刷屏。
- **把 ExecutorPort 直接绑到 Mastra**：domain 反向依赖 runtime，违反分层；端口只固定契约。

## 验证

2026-11-16：`internal-runtime.service.spec` 覆盖 ready 自动结束、blocked 保持并移交、failed 保持并移交、progress 不改状态；Assignment 既有 pending→running→ended 单测继续通过；API 全量单测、typecheck、lint、docs/rules 检查通过。未接真实外部执行器做端到端演练。

## 后果与回滚

- 执行器回报成为工单终态的唯一自动入口；人工仍可通过 `/end`、`/reopen` 操作，审计可追。
- 移交依赖策略存在与授权发起人可解析；缺失时 `RunFailureService` 返回 null，仍写 handover 审计但不产生关注。
- 回滚：移除 `settleTicket` 调用与 `internal.ticket.*` 审计，恢复只结束 Assignment；Ticket 状态不回滚，需人工重开。
