# ADR-0045 执行层采用 Durable Agents 与 Harness Goals

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

执行层不只用 Mastra 的 Agent/Workflow，还采用其长任务能力，避免自建快照与恢复。

- **Durable Agents 进入 V0**：worker 内每次运行以 `createDurableAgent()` 包装，启用 Postgres 快照与运行租约；启动时 `recovery.durableAgents: 'auto'`，崩溃后从最近快照继续。跨进程回放缓存使用 Redis。
- **Harness Goals 进入 V0**：对有客观完成判据的角色启用线程级 Goal（judge 模型 + `maxRuns`），达标即停止，预算耗尽则暂停并转人工。目标在运行前设置、结束后清除；同一线程多工单时按工单设置。
- **职责边界**：Goal 只回答「这一轮做完了吗」，Ticket/Mandate 仍回答「凭什么可以做、能做到哪」；Goal 不授予权限，也不改变任务状态。
- **幂等前置**：工具必须可重放；外部写先在 `agentic_effects` 记录幂等键，再执行。
- **版本策略**：Durable Agents 为 Beta，锁定 `@mastra/core` 版本；升级必须跑恢复演练与评测回归，保留回退到普通 Agent 的开关。

## 被否决的选项

- **自建快照与恢复**：重复框架已有能力，且租约、写栅栏与恢复语义难以自证正确。
- **只靠队列重试**：队列能重投事件，但不能恢复执行到一半的运行状态。
- **用 Goals 替代 Ticket 状态**：Goal 无授权、范围与审计语义，会把执行判据误当业务状态。
- **所有角色都开 Goals**：单步决策角色无迭代收益，只增加调用与延迟。

## 后果与回滚

新增 `agentic_effects` 的使用约束与恢复演练；Mastra 快照表写入量上升，需要保留策略与 autovacuum 调优。工具幂等从「建议」变为「必须」，测试需覆盖重放。

回滚：关闭 durable 包装与 `recovery.durableAgents`，退回普通 Agent + 队列重试；Goal 配置移除后角色按单轮执行；已写入的快照与效果记录保留，不参与新运行。
