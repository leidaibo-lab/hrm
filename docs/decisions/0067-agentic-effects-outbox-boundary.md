# ADR-0067 agentic effects 与 outbox 的幂等边界

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

给外部写接上 `EffectService`，并明确与 outbox 的分工：

- **effects = 外部调用幂等账本**：以消息 `idempotencyKey` 为键，记录 `send_card` 副作用；成功结果可重放，失败可重试，`pending` 并发拒绝。
- **outbox = 投递状态与重试调度**：`pending → sent/gone`、失败次数、下次重试时间。
- **写路径**：`OutboundDispatcher` 先 `effects.execute()` 包裹 `transport.send()`，成功后再 `recordSent`。崩溃在「发送后、recordSent 前」时，下一次由 effect 命中 `succeeded` 直接返回结果，不重复调用外部；outbox 仍为 pending，会补记 sent。
- **永久失败**：`PermanentOutboundError` 让 effect 记 `failed`，outbox 记 `gone`；outbox 不再调度，effects 也不会被再次执行。
- **不重复**：同一幂等键只有一个 effect；`pending` 时并发调用直接拒绝，避免多副本同时发送。

## 被否决的选项

- **只用 outbox**：崩溃窗口内会重复发送，外部系统看到两条卡片。
- **只用 effects**：缺少投递状态、重试时间与 gone 对账，运维不可见。
- **effects 也建一套独立队列表**：与 outbox 状态重复，且需要额外清理策略。

## 验证

2026-11-16：`outbound-dispatcher.service.spec` 断言成功发送写入 `succeeded` effect、失败写入 `failed` effect；`effect.service.spec` 既有重放/并发/永久失败用例继续通过；API 663 项单测、typecheck、lint、docs/rules 通过。未在真实多副本与崩溃窗口下演练。

## 后续修订（2026-11-16）

- pending 超过 `EFFECT_PENDING_TTL_MS` 时判为结果未知：outbox 记 gone，不自动重发。
- 新增 `POST /internal/effects/reconcile`（内部令牌）把超时 pending 标记 gone，需先人工确认外部结果。

## 后果与回滚

- 每条出站消息多一次 effect 查询/写入；V0 量级可接受，后续可合并到 outbox 事务。
- `pending` 的 effect 若是崩溃残留，会阻止同键重发；需要人工/清理任务处理，本轮未做自动恢复。
- 回滚：移除 dispatcher 的 `effects.execute` 包装，恢复直接 `transport.send`；已写 effects 保留。
