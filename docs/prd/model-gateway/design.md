# 模型网关（model-gateway）总体设计

## 一、文档信息

| 项目     | 内容                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 文档编号 | PRD-MODEL-GATEWAY-DESIGN                                                                 |
| 版本     | V3.1（2026-11-17）                                                                       |
| 状态     | 草稿                                                                                     |
| 作者     | 产品与工程共同确认                                                                       |
| 关联决策 | ADR-0015、ADR-0077、ADR-0078、ADR-0079、ADR-0080、ADR-0081、ADR-0082、ADR-0083、ADR-0084 |

### 版本记录

| 版本 | 日期       | 变更                                                               | 原因         | 作者 |
| ---- | ---------- | ------------------------------------------------------------------ | ------------ | ---- |
| V3.0 | 2026-11-17 | 按限界上下文拆分；逻辑模型与候选、失败转移、计费                   | 架构对齐     | lead |
| V3.1 | 2026-11-17 | 以 mastra 为运行中心；价格来源与汇率；命名规范；错误聚合与接口收口 | 设计评审收敛 | lead |

## 二、总体架构与 Super-agent 运行模型

模型网关是支撑子域，不参与调度决策，只承担 provider 域的「解析、调用准备、限额、计量、计价」。

```
调用方（档位 → logicalKey + 能力要求 + 归因）
   │
   ▼
model-gateway
   ├─ 配置：provider / logical model / candidate / 手动价 / 汇率
   ├─ 目录：models.dev 同步（后台任务，不在调用链路）
   ├─ 路由：快照 → 过滤 → 排序 → 截断
   ├─ 运行时：限流、解密、上游调用、分类、流守卫、熔断
   └─ 计量：每次尝试、成本快照、异步落库、报表
   │
   ▼
mastra：调用、重试、fallback、流与工具循环
   │
   ▼
provider
```

职责边界：

| 能力                                                  | 归属               |
| ----------------------------------------------------- | ------------------ |
| 档位（fast/main/judge）语义与档位到 logicalKey 的映射 | 调用方（agentic）  |
| logicalKey 到候选链                                   | model-gateway      |
| provider 凭据、地址、协议适配                         | model-gateway      |
| provider 重试与 fallback                              | mastra（网关产链） |
| 跨请求熔断、限流、429 分类                            | model-gateway      |
| 计价、汇率、成本报表                                  | model-gateway      |
| 工作并发与队列准入                                    | 调用方调度器       |

范围说明：本设计只覆盖 model-gateway 模块；调用方何时改为 `cip/<logicalKey>` 属调用方排期。网关同时兼容 `cip/<slug>/<modelId>`（钉死候选，无 fallback），不作为端到端转移验收依据。

## 三、领域模型

| 概念         | 职责                     | 关键规则                                                           |
| ------------ | ------------------------ | ------------------------------------------------------------------ |
| Provider     | 供应商接入点与凭据       | slug 唯一；enabled（人工）与 health（自动）正交；停用不参与路由    |
| LogicalModel | 业务侧模型名、候选链锚点 | logicalKey 唯一；停用即不可解析；maxAttempts 默认 3                |
| Candidate    | 逻辑模型在供应商上的实现 | (logicalModelId, providerId, providerModelId) 唯一；能力事实落候选 |
| Price        | 价格版本（手动或目录）   | 只追加；手动优先；调用完成时定版                                   |
| FxRate       | 币种到 USD 的汇率版本    | 只追加；rate_to_base 方向固定                                      |
| Usage        | 一次尝试的计量与成本快照 | 只追加；callId 唯一                                                |
| CatalogSync  | models.dev 同步记录      | 只追加；失败不清旧数据                                             |

不变量：

1. 凭据只存密文，解密只发生在调用瞬间。
2. 候选能力是事实，逻辑模型不重复声明。
3. 用量只追加；价格与汇率被引用后不可变。
4. 目录价只是兜底，不覆盖手动价，不参与「价格历史」语义。
5. 每次尝试都有归属；缺失归因显式记为 null 并计数。

状态：

| 对象           | 状态                                  | 说明                                        |
| -------------- | ------------------------------------- | ------------------------------------------- |
| Provider       | enabled/disabled × healthy/degraded   | 只有 enabled 且非 open 的 provider 参与路由 |
| LogicalModel   | enabled/disabled                      | disabled 时解析失败                         |
| Candidate      | enabled/disabled                      | disabled 跳过；历史用量保留                 |
| Price / FxRate | 生效/历史                             | 只追加；按 effectiveFrom 取用               |
| Usage          | success/failed/rate_limited/cancelled | 只追加                                      |

## 四、端到端数据流

### 4.1 配置流

```
管理员 → provider（含 catalogProviderId、限流参数）
       → logical model（logicalKey、maxAttempts）
       → candidate（catalogModelId、能力、优先级）
       → 手动价 / 汇率
写操作同事务后 invalidateSnapshot()
```

### 4.2 目录同步流

```
启动 / 每日 / 手动 / 新建候选触发
  → models.dev /api.json（10s 超时）
  → 匹配 candidate（catalogProviderId + catalogModelId，缺省 providerModelId）
  → 写入目录价（source=models_dev），费率未变跳过
  → 写 CatalogSync（success/failed/partial + unmatched）
失败：保留旧数据并告警；调用链路不访问外网
```

### 4.3 调用流

```
resolveModelChain(logicalKey, requirement, attribution)
  → 快照（TTL 10s）
  → 过滤：logical.enabled、candidate.enabled、provider.enabled、breaker.allows、satisfies(capabilities)
  → 排序：priority 升序、breaker.score 降序
  → 截断：logical.maxAttempts
  → ModelWithRetries[]（每条 maxRetries=0）
mastra 执行 → 失败分类 → 尝试日志 → 熔断记录 → fallback 下一候选
全部失败 → 聚合错误（主错误 + attempts）
```

### 4.4 计价与计量流

```
调用完成
  → resolvePrice：手动（effectiveFrom ≤ t）→ 目录（fetchedAt ≤ t）→ 缺失
  → cost_original = Σ(tokens × rate) / 1e6（价格币种）
  → cost = cost_original × rate_to_base（USD）
  → 入队 usage（jobId = callId）
  → 消费者落库 → 报表按 USD 求和
```

失败分支：

| 场景                   | 处理                                      |
| ---------------------- | ----------------------------------------- |
| 无启用候选             | 返回 model.no_candidate，不重试           |
| 能力不满足             | 返回 model.capability_unsupported         |
| 凭据解密失败           | 返回 model.credential_invalid，不打开熔断 |
| 上游 5xx / 网络 / 超时 | 可转移；连续失败打开熔断                  |
| 上游 429               | 解析 Retry-After 打开熔断；同 run 转移    |
| 400/404/422            | 不可重试；mastra 仍会下探，链长受限       |
| 流中途断开             | 首 chunk 后不转移；记 failed              |
| 缺价 / 缺汇率          | 不阻断推理；成本为空并告警                |
| 全部候选失败           | 聚合错误：首个永久错误优先，否则最后一条  |

## 五、技术方案

### 5.1 与 mastra 的接缝

导出面：

```ts
createGateway(): Promise<MastraModelGateway>;
resolveModelChain(logicalKey, requirement, attribution?): Promise<ModelWithRetries[]>;
resolveModel(logicalKey, attribution?): Promise<LanguageModelV4>;
supportsCapability(logicalKey, requirement): Promise<boolean>;
getProviderHealth(): Promise<ProviderHealthView[]>;
```

- `ModelWithRetries` 的 `id` 使用 candidateId，便于日志与用量关联。
- 每条 `maxRetries: 0`；Agent 同时 `maxRetries: 0`，并用 `StreamErrorRetryProcessor({ maxRetries: 0 })` 覆盖默认 2 次/3s 重试。
- `resolveModel` 为单候选直调，无 fallback，内置限流与计量。
- 模型串规则：含 `/` 视为钉死候选；否则按 logicalKey 解析。

### 5.2 快照

- 一次装配 providers、logical+candidates、当前与下一版手动价、最新目录价、最新汇率。
- TTL 10s；配置、价格、汇率、同步写入后失效；DB 故障回退上一版并告警。
- 快照只保存凭据密文，不保存明文。

### 5.3 限流与熔断

- 限流沿用 Redis 固定窗口 + 并发租约，Redis 故障 fail-open 并告警。
- 熔断为进程内 closed → open → half-open：429 按 Retry-After 打开；瞬时错误连续 5 次打开；半开只放一个探针；成功复位。
- 多副本各自维护，允许短暂不一致。

### 5.4 凭据

全局 CryptoService（AES-256-GCM）注入 infrastructure；调用瞬间解密，失败映射 credential_invalid；日志只记 provider slug，不记密文或明文。

### 5.5 错误与聚合

`ModelCallError` 携带 code、isRetryable、retryAfterMs 与 attempts。每个候选失败写入尝试日志（键为 traceId + logicalKey，TTL 5 分钟）；最后一个候选抛错时取首个永久错误为主错误，否则取最后一条。traceId 缺失或异常被包装时退化为最后一条。

### 5.6 流守卫

首 chunk 前失败可转移；首 chunk 后失败改为写入 error part 并正常结束，避免 mastra 重放已输出内容。并发槽在 done/error/cancel 三态各释放一次。未获取到的 tokens 记 0，不猜测。

### 5.7 计价与汇率

- 价格单位固定为每百万 token；金额 Decimal(18,8)，HALF_UP。
- 解析顺序：手动价 → 目录价 → 缺失。
- 记账币种 USD；`rate_to_base` 表示 1 单位原币折合多少 USD。
- 缺汇率时 cost 为空、保留原币成本并标记 fx_missing。
- 历史成本由 usage 的 priceId、fxRateId 冻结，不随调价或汇率变化重算。

### 5.8 目录同步

models.dev 仅由后台任务访问；同步结果落 CatalogSync；目录年龄、未匹配数进入指标与告警。同步失败不影响调用，旧价格继续可用。

### 5.9 计量与报表

- 每次尝试一行 usage；callId 唯一，BullMQ jobId 同值，防重投重复计费。
- 成本在网关侧算完后入队，消费者只落库。
- 报表按空间、Agent、逻辑模型、候选、日聚合；成本只对 success 求和，失败与限流单独计数。

## 六、文件结构与模块职责

```
apps/api/src/modules/model-gateway/
├── model-gateway.module.ts
├── provider.controller.ts / model.controller.ts / price.controller.ts
├── fx.controller.ts / catalog.controller.ts / usage.controller.ts
├── dto/
├── domain/            # entity、repository/port、error
├── application/       # 用例编排、链解析、导出面
└── infrastructure/    # persistence、snapshot、breaker、限流、mastra 适配、队列、目录客户端
```

分层约束：domain 不依赖 Nest/Prisma/mastra；application 不 import infrastructure；模块入口是唯一组合根；对外只导出 gateway-export.service。

## 七、数据模型

| 表                           | 关键字段                                                                                                                                                                                                | 约束                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| model_gateway_providers      | name、slug、protocol、base_url、api_key_cipher、catalog_provider_id、timeout_ms、enabled、health、open_until、consecutive_failures、rate_limit_per_minute、max_concurrent                               | slug 唯一；(enabled, health) 索引                            |
| model_gateway_logical_models | logical_key、display_name、enabled、max_attempts                                                                                                                                                        | logical_key 唯一                                             |
| model_gateway_candidates     | logical_model_id、provider_id、provider_model_id、catalog_model_id、priority、enabled、timeout_ms、capabilities、default_params                                                                         | 三元组唯一；(logical_model_id, enabled, priority) 索引       |
| model_gateway_prices         | candidate_id、source、currency、input/output/cache_read/cache_write/reasoning、effective_from、fetched_at                                                                                               | (candidate, source, effective_from) 唯一；金额 Decimal(18,8) |
| model_gateway_fx_rates       | base_currency、quote_currency、rate_to_base、effective_from、source                                                                                                                                     | (base, quote, effective_from) 唯一                           |
| model_gateway_usages         | call_id、trace_id、caller、logical_model_id、candidate_id、space_id、agent_key、tokens×5、price_id、price_source、currency、cost_original、cost、fx_rate_id、fx_missing、status、error_code、latency_ms | call_id 唯一；space/candidate/trace 索引                     |
| model_gateway_catalog_syncs  | started_at、finished_at、status、providers、models、prices_written、unmatched、error                                                                                                                    | 只追加                                                       |

## 八、接口与契约

| 方法与路径（全局前缀 /api/v1）                                                                                       | 权限                         | 行为                           |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------ |
| POST /model-gateway/providers/query；GET/POST/PATCH /providers；PUT /providers/:id/enabled；POST /providers/:id/test | model.gateway:read / :manage | 列表、详情、维护、启停、连通性 |
| POST /model-gateway/models/query；GET/POST/PATCH /models；PUT /models/:id/enabled                                    | 同上                         | 逻辑模型维护                   |
| GET/POST /model-gateway/models/:id/candidates；PATCH /candidates/:id；PUT /candidates/:id/enabled                    | manage                       | 候选维护                       |
| GET/POST /model-gateway/candidates/:id/prices；DELETE /candidates/:id/prices/:priceId                                | manage                       | 价格版本与手动价               |
| GET/POST /model-gateway/fx-rates                                                                                     | read / manage                | 汇率版本                       |
| GET /model-gateway/catalog、/catalog/:providerId；POST /catalog/sync；GET /catalog/syncs                             | read / manage                | 目录预览、同步、记录           |
| POST /model-gateway/usages/query；GET /usages/summary                                                                | read + space 谓词            | 用量与成本报表                 |

运行时契约：createGateway、resolveModelChain、resolveModel、supportsCapability、getProviderHealth。

错误码（共享目录）：model.no_candidate、model.logical_model_not_found、model.rate_limited、model.credential_invalid、model.request_invalid、model.timeout、model.provider_unavailable、model.capability_unsupported、model.catalog_unavailable。

## 九、扩展与接入

- 新增 provider：实现协议适配与连通性探测，登记凭据与 catalogProviderId。
- 新增候选：为已有逻辑模型增加候选、优先级与能力，不改业务。
- 新增能力：候选声明能力，解析时按 requirement 过滤。
- 新增计价维度：价格表扩展列，历史用量不变。
- 新增汇率来源：FxRate 表增加 source，不改调用链。
- 调用方接入：使用 resolveModelChain 获取链；钉死串继续兼容。

## 十、部署与运维

- api 与 worker 同镜像；同步与计量消费者在 worker 运行。
- 同步计划：启动、每日、手动、新候选触发；失败告警并保留旧数据。
- 指标：链解析耗时、尝试次数、熔断打开、限流拒绝、计量入队失败、缺价、缺汇率、目录年龄、未匹配数、快照加载失败。
- 告警：计量入队失败、缺价/缺汇率、目录年龄超过 7 天、熔断持续打开、对账差异。
- 保留：usage 13 个月；catalog sync 90 天；被引用的价格与汇率随用量保留。
- 凭据：主密钥丢失需重新录入；轮换需支持新旧密钥并存（运维流程）。

## 十一、设计边界、风险与待决项

| 项       | 风险或边界                                                                    |
| -------- | ----------------------------------------------------------------------------- |
| 失败转移 | mastra 对任意错误都换下一候选，永久错误也会下探；以链长上限与聚合错误控制影响 |
| 链固定   | 链在一次 run 构建，同 run 后续 step 不重排；熔断在下一 run 生效               |
| 流式     | 首 chunk 后不转移；守卫流将错误转为终止 error part                            |
| 聚合错误 | 依赖 mastra 原样抛出最后一个错误；被包装时退化为最后一条                      |
| 限流     | 固定窗口存在边界突发；以 provider 反馈与熔断补足                              |
| 计量     | 异步入队可能丢失；以死信、对账与告警兜底                                      |
| 目录     | 外部数据可能陈旧或未匹配；以年龄告警与未匹配报告兜底                          |
| 汇率     | 手工维护可能滞后；缺汇率不猜测；历史不重算                                    |
| 钉死串   | 兼容期内无 fallback；端到端转移依赖调用方切换                                 |

## 十二、变更记录

| 日期       | 变更                                                               | 原因         | 作者 |
| ---------- | ------------------------------------------------------------------ | ------------ | ---- |
| 2026-11-17 | 按限界上下文拆分；逻辑模型与候选、失败转移、计费                   | 架构对齐     | lead |
| 2026-11-17 | 以 mastra 为运行中心；价格来源与汇率；命名规范；错误聚合与接口收口 | 设计评审收敛 | lead |
