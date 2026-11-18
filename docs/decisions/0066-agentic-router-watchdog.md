# ADR-0066 agentic Router 慢路径与 Watchdog 开关

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

补齐 `router` 角色的慢路径，并把 `watchdog` 的确定性扫描纳入策略开关：

- **Router 慢路径**：策略 `routerAgentEnabled=true` 时，准入通过后先用 fast 档 `ROUTER_AGENT` 判断相关性与是否值得执行；`worthProcessing=false` 时把本批事件标记 filtered（原因 `router_agent:<reason>`），不进入 Eval。
- **降级**：无模型路由、网关失败或输出非法时返回 null，Router 继续走确定性准入 + Eval，不阻断事件。
- **Watchdog**：保留 worker 内的确定性周期扫描（过期关注、提醒、停滞工单），新增策略 `watchdogEnabled=false` 可整体跳过停滞扫描；不引入 Mastra Schedules，避免与现有 worker 周期重复、也避免多副本重复调度。
- **角色边界**：router 角色只回答相关性与范围建议，不在本路径执行；watchdog 本轮不调用模型，只保留确定性扫描与开关。
- **策略**：`routerAgentEnabled` 缺省 false；`watchdogEnabled` 缺省 true。

## 被否决的选项

- **Router 每条事件都调用模型**：成本与延迟高且会重复 Assessment；开关默认关闭，仅在灰度策略开启时使用。
- **Watchdog 改用 Mastra Schedules**：现有 worker 已有秒级扫描与单实例约束，再建 Schedules 会双跑；保留确定性路径并加开关。
- **Router 判定失败即过滤**：失败应回退确定性路径，不能静默丢事件。

## 验证

2026-11-16：`router.service.spec` 覆盖开启后不值得过滤、慢路径不可用回退研判；`router-decision.service.spec` 覆盖无模型路由与网关失败返回 null；`attention-scheduler.service.spec` 覆盖 `watchdogEnabled=false` 跳过停滞扫描；API 662 项单测、typecheck、lint、docs/rules 通过。真实模型下的 Router 判定质量未验证。

## 后果与回滚

- Router 慢路径多一次 fast 模型调用，仅策略开启时发生；失败自动回退。
- Watchdog 关闭只跳过停滞扫描，关注过期与提醒仍执行。
- 回滚：删除 `routerAgentEnabled` 即回到原路径；`watchdogEnabled` 缺省 true 保持现行为。
