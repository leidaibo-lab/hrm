# ADR-0015 model-providers 模型服务商网关（基于 mastra）

> 状态：已接受 · 日期：2026-11-03 · 级别：L3

## 决定

引入 `@mastra/core@1.81.0` 与 `@ai-sdk/openai-compatible@3.0.84`（版本全仓锁定，经 supply-chain 校验）。新建业务域 `modules/model-providers`（模型接入）：供应商 / 模型 / 计价 / 用量四实体；mastra 自定义网关 `ConfiguredModelGateway extends MastraModelGateway`（class-based）落模块 `infrastructure/gateway/`；计量与限流以 LanguageModel 手写包装内建于网关返回实例；`adapters/` 新增三个技术适配器：`crypto`（AES-256-GCM 公共加解密）、`queue`（BullMQ）、`http`（原生 fetch 薄封装：超时 / 错误归一 / JSON）。

`architecture.md` 修订两处：

1. 技术适配器清单（规则 1）移除「模型 provider」——网关配置全部来自页面（DB 驱动），非 env 注入的技术设施；清单补入「加解密（AES-256-GCM）」。补偿条款：**模型接入统一经 model-providers 导出的 `GatewayExportService`**（跨域唯一入口）；**Agent 编排统一经未来 agents 域导出 Service**。域层禁止 import mastra（与禁 `@nestjs/*`、`@prisma/client` 同理）。
2. 契约规则 7 增补领域前缀段：多顶级资源的业务域可用领域前缀分组（首个 `ai`：`/ai/providers`、`/ai/models`、`/ai/usages`、`/ai/catalog`）；领域前缀段不计子资源嵌套层；单资源模块保持平铺；存量路由不回改。

关键机制：

- **消费接缝**：agents 域经导出的 `createGateway()` 注册到自己的 Mastra 实例，模型字符串 `cip/<slug>/<modelId>`，路由 / 重试（默认 2 次退避）/ fallback 链由 mastra 接管；`resolveModel()` 为辅助直调路径（连通性测试、脚本）。
- **计量**：手写包装 `LanguageModelV4`（纯对象接口，包 `doGenerate` / `doStream`），usage 取 AI SDK 官方解析值（与 mastra 可观测性同源）；AsyncLocalStorage 上下文（traceId / caller，未来 runId）在调用现场同步采集、随队列载荷携带 → BullMQ 异步落 `ModelUsage`；取价时点为调用完成入队时，落 `pricingId` 价格快照防漂移；计量失败只进死信不影响推理。
- **计价**：版本化一版一行 + `effectiveFrom`；models.dev 导入向导为基线填充（upsert，仅填空缺不覆盖已配置值），自有表为计费事实源。
- **限流**：Redis 令牌桶，provider 级 `rateLimitPerMinute` / `maxConcurrent` 页面配置；有界排队，超时抛 `model.rate_limited`（`isRetryable: false`，防 mastra 重试风暴）；Redis 故障 fail-open + 告警日志。
- **凭据**：`adapters/crypto` AES-256-GCM（逐值随机 IV）；`CREDENTIAL_MASTER_KEY` 为唯一 env 项；密钥 / 密文永不入日志。
- **删除保护**：账务数据全链 `onDelete: Restrict` 显式声明；有引用的记录只能停用，禁止物理删除。

实测结论（装包验证，2026-11-03，依据 `@mastra/core` 1.81.0 类型定义与 bundle）：

| 项                   | 结论                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GatewayLanguageModel | `LanguageModelV2 \| V3 \| V4` 三代并列；本网关固定产出 V4                                                                                     |
| openai-compatible    | `@ai-sdk/openai-compatible@3.0.84` 产出 `specificationVersion: 'v4'`；`provider.chatModel(modelId)` 与 mastra 官方 JSDoc 示例一致             |
| fetchProviders 时机  | 仅 dev 动态模式 registry 同步调用；运行时解析走注册的 gateway 实例，直调无前置条件                                                            |
| usage 形态           | V4 嵌套：`inputTokens{total,noCache,cacheRead,cacheWrite}` / `outputTokens{total,text,reasoning}`；据此 `ModelUsage` 增 `cacheWriteTokens` 列 |
| middleware           | `wrapLanguageModel` 属 `ai` 包（provider-utils 无此导出）；改手写包装，零新增依赖                                                             |
| 重试标记             | provider-utils `isRetryable?: boolean`；mastra llm 循环消费该标记（bundle 10 处命中）                                                         |

## 被否决的选项

- 裸 Vercel AI SDK 自研路由（不引 mastra）：放弃模型路由 / 重试 / fallback / 可观测生态，未来 agents 域同栈复用为零。
- 网关落 `adapters/`（初始方案）：配置全部页面管理（DB 驱动），非 env 注入设施；跨域消费又必须经模块导出面，adapter 层空转。改落模块 `infrastructure/gateway/` 并修订规则 1。
- AI SDK `wrapLanguageModel` 中间件：需引入整个 `ai` 包且 provider-utils 无此导出；`LanguageModelV4` 为纯对象接口，手写包装零依赖且按 spec 版本显式归一。
- `tenantId` 用量列：仓库无租户概念，不预建；多租户落地时加列（小迁移）。
- models.dev 定时自动同步：手动导入向导满足「页面配置为主」；定时任务增加运维面。
- 计价单行原地更新：调用历史无从对账；版本化 + 快照是账务完整性要求。

## 后果

- `ModelUsage` 含 `cacheWriteTokens` 列（V4 usage 带出 cacheWrite，配 `ModelPricing.cacheWrite` 计价精度完整）。
- 主密钥丢失 = 全部供应商凭据需重新录入（运维注意）。
- 队列故障丢计量不丢推理（BullMQ 持久化 + 死信兜底）。
- 流中断 usage 可能缺失：如实记 `failed` / 部分值，不补偿性猜测。
- 回滚路径：移除两个依赖（封装隔离在 `infrastructure/gateway/` 一处）+ 恢复规则 1「模型 provider」字样 + 回退规则 7 增补；`ModelUsage` 等数据表保留无碍回退。
