# ADR-0070 BullMQ 自定义 jobId 冒号净化

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 问题

真实回调联调发现：`POST /connector/lark/:instanceId/events` 返回 500，日志为
`Error: Custom Id cannot contain :`。BullMQ 6 的 `Job.validateOptions` 拒绝包含冒号的
自定义 `jobId`，而队列实现使用 `route:<triggerId>`、`breakdown:<ticketId>`、
`clarify:<ticketId>`，通知队列直接使用含冒号的幂等键。事件已落库但入队失败，回调无法 ACK。

## 决定

在队列适配器 `QueueService.enqueue` 统一净化自定义 jobId：

- `jobId` 中的 `:` 替换为 `-`，其余字符保持不变。
- 未提供 jobId 时行为不变。
- 去重语义不变：同一业务键仍映射到同一 jobId；不同键因替换产生的碰撞概率在 UUID 键下可忽略。

调用方的可读前缀保留（`route-`、`breakdown-`、`clarify-`），不在每个队列重复实现。

## 被否决的选项

- **逐个调用方替换**：易漏（通知队列用动态幂等键），新队列还会踩坑。
- **直接哈希 jobId**：可读性差，排障困难；且改动面更大。
- **捕获异常后降级为无 jobId**：失去去重，重复回调会重复入队。

## 验证

2026-11-16 本地隔离库 + 真实 API 进程：

- 修复前：回调 500，`Custom Id cannot contain :`，`agentic_triggers` 已写入但队列无任务。
- 修复后：同一回调返回 `{"code":0}`，触发去重键落库，Redis 出现
  `bull:agentic-routing:route-<uuid>`。
- 新增 `sanitizeJobId` 单测：冒号替换、无冒号与 undefined 保持原样。

未验证：BullMQ 升级后的行为差异；多副本下同键并发入队的去重强度。

## 后果与回滚

- 已存在的含冒号 jobId 不会被自动迁移；历史失败任务需要人工重放（本次未做）。
- 回滚：移除 `sanitizeJobId` 调用，恢复直接传 `options`；会重新触发 500，不建议。
