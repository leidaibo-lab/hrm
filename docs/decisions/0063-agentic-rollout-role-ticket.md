# ADR-0063 agentic 灰度扩展到角色与工单

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

在既有「来源 / 项目」异步路由灰度上增加「角色 / 工单」两个维度：

- **规则**：`routingRollout.roles`（`router|assess|clarify|breakdown|watchdog`）与 `routingRollout.ticketIds`；空/缺省表示不限。
- **判定**：`RoutingRolloutService.decide()` 按来源、项目、角色、工单逐项 AND；返回 `{ enabled, configured, reasons }`，未命中原因可审计。
- **回退**：`enabled=false` 或任一层未命中时，接入入口回退同步路由；不丢事件、不改数据库。
- **审计**：配置了灰度规则时写 `routing.rollout`（traceId `trigger-<id>`，含四维输入、结果与原因）；写失败只告警，不影响接入。
- **调用方**：接入入口以 `role: 'assess'` 判定（异步路由先执行研判）；其余调用方可传具体角色/工单，未传且规则包含对应维度时按未命中处理。

## 被否决的选项

- **只按来源/项目**：无法按角色分批启用，也无法对单个工单回退。
- **规则间 OR**：会让某个维度形同虚设；灰度必须逐项收紧。
- **缺维度时放行**：角色/工单维度配置后，调用方没传值应视为未命中，避免绕过灰度。
- **每个事件都写审计**：仅在配置了规则时写，未配置时保持零额外写入。

## 验证

2026-11-16：`routing-rollout.service.spec` 覆盖角色/工单命中与未命中原因、无规则不审计；`ingress.service.spec` 覆盖未命中回退同步路由并写 `routing.rollout`；API 全量单测、typecheck、lint、docs/rules 通过。未做多副本下真实流量灰度切换演练。

## 后果与回滚

- 配置 `ticketIds` 后，接入入口没有工单上下文，会按未命中回退同步；需要按工单灰度时应由知道 ticketId 的调用方使用。
- 灰度判定多一次策略读取；规则未配置时不额外读数据库（策略本身已缓存）。
- 回滚：从策略规则删除 `roles`/`ticketIds`，或整体删除 `routingRollout`；已写审计保留。
