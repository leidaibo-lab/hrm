# ADR-0051 agentic 指标埋点与内部 Prometheus 导出

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

补齐 operations.md §五的指标需求，先实现进程内指标与内部 Prometheus 导出。

- **指标**：`agentic_events_total{event=trigger_received|ticket_opened|attention_raised|ticket_ended}`、`agentic_runs_total{role,result}`、`agentic_tokens_total`（累计 token）。
- **实现**：`modules/agentic/domain/metrics.port.ts` 导出全局单例 `metrics`，业务代码直接 `increment/observe`，避免为每个服务增加构造依赖；V0 为进程内内存指标，多副本各自暴露，接入集中式后端时替换实现。
- **导出**：`GET /internal/metrics`（Prometheus 文本），沿用 ADR-0049 的 `x-internal-token` 共享令牌；端点审计公开路由白名单按本 ADR 更新。
- **采集点**：事件入站、接单开票、关注创建、工单结束、worker 运行结果、runtime token 用量。
- **检查设施**：端点审计的 controller 清单、权限矩阵快照与公开路由白名单变更，按本 ADR 更新 protected 基线。

## 被否决的选项

- **直接引入 Prometheus SDK/集中式 pushgateway**：V0 无部署依赖，先做最小文本导出。
- **每个服务注入 MetricsService**：会扩散构造依赖与测试改动；V0 用全局单例。
- **指标写数据库**：高频计数不适合业务表，后续接指标后端。

## 后果与回滚

- 指标随进程重启清零、多副本不聚合；验收「可观测」需再接入 scrape 与聚合。
- 回滚：删除 `/internal/metrics` 与埋点调用，恢复端点审计基线；业务数据无影响。
