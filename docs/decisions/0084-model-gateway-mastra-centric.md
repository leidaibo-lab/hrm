# ADR-0084 模型网关以 mastra 为运行中心

> 状态：已接受 · 日期：2026-11-17 · 级别：L3

## 问题

ADR-0015 的网关只产出单个模型实例，重试与 fallback 由 mastra 承担；但后续设计一度把候选链转移、退避与重试放回网关，形成两层重试，既放大 429 风暴，也与「围绕 mastra 构建」的目标冲突。同时，价格只有人工维护、缺少目录兜底与多币种换算，缺价即无法计费。

## 决定

1. 网关只负责「配置、凭据、候选链、限流、计量、熔断、计价」；重试与 fallback 归 mastra。
2. 导出面为：`createGateway`、`resolveModelChain`、`resolveModel`、`supportsCapability`、`getProviderHealth`。`resolveModelChain` 返回 `ModelWithRetries[]`，每条 `maxRetries: 0`；Agent 同时 `maxRetries: 0`，并用 `StreamErrorRetryProcessor({ maxRetries: 0 })` 覆盖默认重试。`resolveModel` 为单候选直调，无 fallback。
3. 熔断归网关：进程内 closed/open/half-open，429 按 Retry-After 打开，瞬时错误连续 5 次打开，半开单探针。
4. 逻辑模型独立成表，作为候选链锚点与用量归因维度；候选能力为事实，调用方按 requirement 过滤。
5. 价格来源优先级：手动价 > models.dev 目录价 > 缺失；目录由后台同步写入，调用链路不访问外网。
6. 记账币种 USD：原币成本按 `rate_to_base` 折算；汇率只追加；缺汇率时成本为空并告警，历史不重算。
7. 每次尝试一行用量，`callId` 唯一且作为队列 jobId；成本在调用完成时定版。
8. 全部候选失败时返回聚合错误：首个永久错误优先，否则最后一条，并附全部尝试；异常被包装时退化为最后一条。
9. 路由统一为 `/api/v1/model-gateway/*`；权限点 `model.gateway:read` / `model.gateway:manage`。

## 被否决的选项

- **网关内自研 attempt 循环与退避**：与 mastra 的 fallback 叠加成两层重试，最坏 9 次上游调用。
- **只用 `AgentConfig.maxRetries`、不用 fallback 数组**：无法跨 provider 转移，G2 不成立。
- **把逻辑模型放回业务域或下沉为候选字段**：网关反向依赖业务，或丢失独立启停与归因维度。
- **只用手工价、不接目录**：缺价即无法计费；只靠目录、不接手工价：调价与折扣无法落地。
- **多币种直接混算**：报表口径不可比；必须先折算为统一记账币种。
- **把错误处理拆到调用方**：调用方拿不到候选尝试上下文，无法给出可排障的主错误。

## 后果与回滚

- 网关新增候选链、快照、熔断、目录同步、汇率与聚合错误；ADR-0015 中「网关产单模型」的消费方式被本 ADR 扩展（`resolveModel` 仍保留）。
- 端到端转移验收依赖调用方切换 `resolveModelChain`；钉死串 `cip/<slug>/<modelId>` 继续兼容但无 fallback。
- 目录与汇率引入外部/人工数据依赖，需配套年龄告警与缺价对账。
- 回滚：revert 本批实现与 PRD 修订；保留表结构与数据不影响旧模块；调用方继续使用钉死串。

## 后续批次（待办）

以下不随本 ADR 实现，按顺序推进；每批单独提交、单独回滚：

1. **控制台写操作**：供应商新建/编辑/启停/连通性、候选维护、手动价、汇率、目录同步与导入；当前只有只读 providers/usages 页。
2. **契约补齐**：provider/model 的 `POST /query` TableView 查询，替换当前 `GET` 列表，并同步 DTO、端点审计与权限快照。
3. **切流**：agentic 六处运行时服务改导入新 `GatewayExportService`；旧 `/admin/ai/*` 页面重定向到 `/model-gateway/*`；随后从 `app.module` 移除 `ModelProvidersModule` 并删除旧模块。
4. **环境验证**：真实 PostgreSQL 执行迁移、Redis/BullMQ 计量消费、models.dev 同步、真实供应商流式与 fallback 的端到端证据；补 PRD B7 中标记「待创建」的测试。
