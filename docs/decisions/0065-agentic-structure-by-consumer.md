# ADR-0065 agentic 结构补齐以消费方为准

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

收口 `file-structure.md` §5.2 的待创建清单，只落有真实消费方的文件：

- **`subscription.service.ts`**：工单接单时在 `AcceptanceRepository` 同一事务写入 `Subscription(reason='started')`；此前没有任何代码创建订阅，导致 Router 的 Fast Path 扇出永远不命中。服务同时提供按线程查询与撤销。
- **`recall.service.ts`**：把 `search-similar` 工具里的线程遍历、词面预筛与语义重排上移到 application，工具改为依赖 `RecallPort`；runtime 不反向依赖 application。
- **不预建**：`correlation.entity.ts`、`reply-target.entity.ts`、`runtime/prompts/`、connector 的 zentao/gitlab 适配器目前无消费方，创建即空壳；随对应功能落地。
- **Web `hooks/`**：维持 ADR-0048 的决定，等出现可复用交互逻辑再建目录，不建空壳目录。

## 被否决的选项

- **为对齐目录树而建空实体/空目录**：违反「无空壳服务」，也增加后续改动面。
- **订阅在接单后异步补写**：失败会出现「有工单但永不扇出」的静默状态；改为同事务。
- **工具直接 import application 服务**：infrastructure → application 违反 ARC-5.6；用 `RecallPort` 解耦。

## 验证

2026-11-16：`acceptance.service.spec` 断言接单写入 `started` 订阅；`search-similar.tool.spec` 改由 RecallService 驱动，语义重排/降级用例继续通过；`file-structure.spec` 服务数量 39 与服务清单一致；API 657 项测试、typecheck、lint、docs/rules 通过。订阅事务的真实数据库行为未在隔离库重放。

## 后果与回滚

- 新工单会自动订阅其线程，后续同线程事件走 Fast Path 扇出；这是此前缺失的行为，属于修复而非新功能。
- 订阅写入与结论/授权/工单同事务，失败整体回滚，不产生半接单状态。
- 回滚：从 `AcceptanceRepository.accept` 去掉 subscription 参数与事务写入；已写订阅保留（只影响扇出）。
