# ADR-0068 agentic gone 外部渠道告警

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

给 outbox 永久失败（gone）增加可配置的外部渠道告警，默认关闭：

- **配置**：策略规则 `goneNotifyChatId`（飞书 chat_id）；缺省不发送外部告警，仍保留 App 内关注与审计。
- **入队**：`OutboundDispatcher.raiseGoneAlert()` 在 gone 时向同一来源实例入队一条告警消息，地址 `{ chatId }`，payload `{ kind: 'alert', text }`。
- **去重**：幂等键 `gone-alert:<原消息 id>`，同一失败消息只告警一次；outbox 的唯一键保证重复派发不会产生第二条。
- **防递归**：告警消息自身 gone 时不再生成新告警（`payload.kind === 'alert'` 直接返回）。
- **职责分离**：effects 管外部调用幂等，outbox 管投递与告警；告警消息仍走同一出站链路，受配额、暂停与失败计数约束。

## 被否决的选项

- **直接调用 transport 发告警**：绕过 outbox 重试/配额，且失败无记录。
- **按工单去重**：同一工单可能有多条失败消息，运维需要逐条证据；按消息 id 去重更精确。
- **默认开启某个固定群**：仓库不知道目标群，硬编码会打扰错误对象；由策略显式配置。

## 验证

2026-11-16：`outbound-dispatcher.service.spec` 覆盖配置目标后 gone 入队 `gone-alert:` 消息、告警只入队一次、告警消息不再递归；API 664 项单测、typecheck、lint、docs/rules 通过。未在真实飞书群验证告警送达。

## 后果与回滚

- 配置 `goneNotifyChatId` 后，每次永久失败会多一条出站消息；告警自身失败会进入普通 outbox 重试/失败流程。
- 告警文本只含失败原因，不含工单正文或用户数据。
- 回滚：删除策略键即停止外部告警；已入队告警保留。
