# agentic 总体设计

## 一、文档信息

| 项目     | 内容                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------- |
| 文档编号 | PRD-AGENTIC-DESIGN                                                                                      |
| 版本     | V3.0（2026-11-17）                                                                                      |
| 状态     | 草稿                                                                                                    |
| 作者     | 产品与工程共同确认                                                                                      |
| 关联决策 | ADR-0042（Super-agent）、ADR-0043（领域模型）、ADR-0045（持久执行）、ADR-0077（结构与单模块）、ADR-0078 |

### 版本记录

| 版本 | 日期       | 变更                                              | 原因     | 作者 |
| ---- | ---------- | ------------------------------------------------- | -------- | ---- |
| V3.0 | 2026-11-17 | 目标设计重写：调度器、Mastra 执行面、外部依赖边界 | 架构对齐 | lead |

## 二、总体架构与 Super-agent 运行模型

### 2.1 设计定位

agentic 是常驻的任务托管平台。Super-agent 是它的调度内核：决定接不接、给谁做、何时找人、做完没有，不执行业务智能。业务系统通过 Source 接入，业务能力通过 AgentSpec 与 Policy 接入；执行由 Mastra 承载，业务事实只由 Engine 写。

核心问题：单会话 Agent 无法托管多条任务线，分工依赖提示词与模型临场判断。因此把调度从模型判断中拿出来，变成常驻、有状态、可审计的内核。

### 2.2 六条原则

1. 单一写者：只有 Engine 写业务状态；外部工作先落库、提交后执行。
2. 排队优先：所有异步工作默认入队，由调度器统一准入，外部事件不直接触发执行。
3. 执行有界：worker 是有界池，工单是调度单元，不是一个工单一个进程。
4. 事实与缓存分离：业务事实只在 PostgreSQL；Mastra 记忆与快照只是可重建缓存。
5. 默认不可信：模型给出的 ID、外部文本、工具参数一律视为数据；授权只来自 Engine 与能力令牌。
6. 可回放：每个决策、每次执行、每次外部写都有 traceId 与审计。

### 2.3 四平面

```
接入面 Ingress
  Source（飞书长连接优先，webhook 备选）
  验签 / 翻译 / 幂等 / 范围 / 授权 → Trigger
  内联：硬过滤 → Gate → 订阅直通（不调模型）
控制面 Control
  Engine：状态机、授权、幂等、分派、关注（唯一写者）
  Scheduler：全局队列、优先级、公平、互斥、租约、背压
  Passes：到期、提醒、停滞、恢复、对账（BullMQ）
执行面 Execution
  Worker Pool（有界 slot）
  Mastra durable session（每 assignment 一个）
  Workspace + Sandbox（Docker / 远程）
  Tools（能力令牌 + 审批）
证据面 Evidence
  TraceSink（自建）→ trace_span + audit_logs
  Effect / Outbox 账本 → Channel（飞书）
外部依赖（各自独立 PRD）
  model-gateway：模型调用；只经其导出服务，不展开其领域设计
  iam：身份、Space 与资源判定；只经其导出服务，不展开其领域设计
```

### 2.4 组件职责

| 组件              | 负责                                         | 不负责                 |
| ----------------- | -------------------------------------------- | ---------------------- |
| Source            | 事件翻译、范围、授权、健康、Channel          | 写业务表、判断接不接   |
| Engine            | 状态机、授权、幂等、分派、关注；唯一写者     | 执行任务、调用工具     |
| Scheduler         | 队列、优先级、公平、并发、租约、恢复         | 调用模型、修改业务状态 |
| Passes            | 周期扫描与对账                               | 业务判定               |
| Runtime（Mastra） | Agent 回合、持久执行、工作区、记忆           | 建单、授权、对外发言   |
| 外部依赖          | iam（身份与授权）、model-gateway（模型调用） | 其领域设计、数据模型   |
| Outbox / Effects  | 外部副作用账本与投递                         | 决定做什么             |
| Console           | 只读投影与人的操作入口                       | 复制核心判断           |

### 2.5 硬规则

1. 只有 Engine 写领域状态；所有外部工作先落库、提交后执行。
2. 只有 Eval 能创建工单；授权不可变，扩范围即新工单。
3. 订阅只提供上下文，不授予权限。
4. 同一 Thread 同时只跑一次 Eval。
5. 关注必有人、有时限；超时升级，不自动通过。
6. 业务状态不写入记忆或快照。
7. 外部写只经 Outbox；工具必须幂等。
8. 资源必须带 spaceId 并归属 iam 维护的 Space；越界读写在数据访问层被拒绝。

## 三、领域模型

### 3.1 概念与归属

| 概念            | 职责                                                   | 归属              |
| --------------- | ------------------------------------------------------ | ----------------- |
| Space（空间）   | 外部概念：数据可见性与工作归属边界；本域只引用 spaceId | iam（见 PRD-IAM） |
| SpaceMember     | 外部概念：用户与空间的成员关系                         | iam（见 PRD-IAM） |
| RoleAssignment  | 外部概念：角色授予                                     | iam（见 PRD-IAM） |
| Source          | 事件流；kind 是类型，instance 是配置                   | agentic           |
| Trigger         | 不可变事件，幂等与审计单元                             | agentic           |
| Thread          | 同一对象的事件流；同一时刻只跑一次 Eval                | agentic           |
| Channel         | Thread 的写侧、回复目标                                | agentic           |
| Policy          | 版本化规则与准入                                       | agentic           |
| Eval            | Gate（确定性准入）+ Assessment（模型研判）             | agentic           |
| Decision        | accept / stop / ignore / unavailable                   | agentic           |
| Mandate         | 授权：范围、强度、策略版本、发起人；不可变             | agentic           |
| Ticket          | 被授权的工作单元，只由 Eval 创建                       | agentic           |
| Assignment      | 工单与一次执行的绑定                                   | agentic           |
| Subscription    | 工单与 Thread 的多对多                                 | agentic           |
| Attention       | 等人决定的问题；必须有等待对象与时限                   | agentic           |
| Artifact        | 产物版本链，只追加                                     | agentic           |
| Effect / Outbox | 外部副作用账本与投递                                   | agentic           |
| AgentSpec       | 执行者规格：模型档位、提示词、工具、权限、限制         | agentic           |
| Session         | AgentSpec 的一次运行实例                               | agentic           |
| Workspace       | 一个 assignment 的目录与环境                           | agentic           |

关系：Trigger N:1 Thread；Decision N:1 Thread 且 N:M Trigger；Policy 1:N Decision/Mandate；Mandate 1:1 Ticket；Ticket N:M Thread；Ticket 1:N Assignment/Attention/Artifact；Assignment 1:N Report；Space 1:N 资源；User N:M Space。

### 3.2 状态机

| 对象       | 状态                                        | 迁移                     |
| ---------- | ------------------------------------------- | ------------------------ |
| Trigger    | pending / filtered / evaluated / fanned_out | 接入与研判推进，仅一次   |
| Thread     | open / dormant / closed                     | 长期无事件、人工关闭     |
| Ticket     | open / ended                                | 人结束、就绪报告；可重开 |
| Assignment | pending / running / ended                   | 派工创建与终结           |
| Attention  | open / answered / expired                   | 人回答、超时升级         |
| Artifact   | draft / confirmed / superseded              | 追加、确认、回滚         |
| Effect     | pending / succeeded / failed / gone         | 外部调用结果             |
| Outbox     | pending / sent / gone                       | 投递结果                 |

Ticket 阶段只读推导：person/delivery、person/answer、person/review、person/blocked|failed、working/queued、idle、working，自上而下第一个匹配即当前阶段。

### 3.3 不变量

| 编号 | 不变量                       | 违反后果               |
| ---- | ---------------------------- | ---------------------- |
| I1   | 只有 Eval 能创建工单         | 未授权任务进入执行     |
| I2   | 授权不可变，扩范围即新工单   | 审计无法归因           |
| I3   | 订阅不授予权限               | 越权读取               |
| I4   | 同一线程同时只跑一次 Eval    | 并发分叉、重复建单     |
| I5   | 工单状态独立于执行器         | 执行器崩溃导致状态错乱 |
| I6   | 不存在跨 Space 的单一工单    | 授权与执行边界不确定   |
| I7   | 事件幂等，重放不产生第二结果 | 重复工单、重复外发     |
| I8   | 决策必须带策略版本与依据     | 结果不可解释           |
| I9   | 关注必须有人、有时限         | 任务掉地               |
| I10  | 业务状态不写入记忆或快照     | 出现第二事实源         |

## 四、端到端数据流

### 4.1 主链路

```
飞书事件 → Source 插件 → Trigger（幂等 / 线程 / actor / space）
  → 内联：硬过滤 → Gate → 订阅直通（signal）
  → 否则 Triage 队列：线程锁 + 合批 + Assessment → Decision
  → accept 单事务：Decision 关联 + Mandate + Ticket + Subscription + 首个 Assignment
  → 调度器派工 → Workspace 准备 + durable Session 启动
  → 执行 → Report（progress / waiting / ready / blocked / failed）
  → ready 结束工单；blocked / failed 转关注；waiting 等后续事件
  → Artifact / Attention / Effect → Outbox → Channel 回写来源
  → TraceSink / audit（traceId 全程贯穿）
```

### 4.2 六条链路

| 链路    | 参与方           | 输入                         | 状态变化                           | 输出               | 失败分支                                         |
| ------- | ---------------- | ---------------------------- | ---------------------------------- | ------------------ | ------------------------------------------------ |
| L1 接入 | Source           | 平台长连接或回调             | Trigger 落库；Thread 新建或追加    | Trigger、入队/直通 | 未授权/重复/自身消息丢弃或 filtered；积压告警    |
| L2 研判 | Engine           | Trigger 批次、线程快照、策略 | Trigger → evaluated；Decision 落库 | Decision           | 模型不可用 unavailable；超时重入队或 unavailable |
| L3 工单 | Engine           | accept Decision              | 新建工单、授权、订阅、派工         | 工单进入执行       | 范围冲突、跨 Space 拒绝建单                      |
| L4 闸门 | Engine ↔ 人      | 问题、选项、时限             | Attention open → answered/expired  | 回答、修改、驳回   | 超时升级；重复回答 409                           |
| L5 执行 | Executor         | 工单、上下文、AgentSpec      | Assignment pending→running→ended   | Report、Artifact   | 停滞转人工；失败转关注；崩溃恢复                 |
| L6 回写 | Outbox / Channel | 回执、产物、写回字段         | Effect/Outbox 状态迁移             | 外部消息送达       | 永久失败 gone + 告警；不重复发送                 |

### 4.3 三级过滤与 fast / slow path

| 阶段     | 位置                       | 内容                                                             | 调模型 |
| -------- | -------------------------- | ---------------------------------------------------------------- | ------ |
| 硬过滤   | 接入层内联                 | 验签、自身消息、空文本、实例停用、授权失效、重复幂等键、跨 Space | 否     |
| Gate     | 接入层内联（策略快照缓存） | 名单、点名、准入单元格 → pass / filtered，写 disposition         | 否     |
| 订阅直通 | 接入层内联                 | 已订阅 Thread → fanned_out，signal 给存活 assignment             | 否     |
| 慢路径   | Triage 队列                | 线程锁 + 合批（≤50）+ Assessment → Decision                      | 是     |

Gate 缓存未命中时降级为入 Triage 再判，保证正确性。

### 4.4 人工闸门两段式

```
① Engine 事务写 Attention（open，dueAt）
② 会话侧 workflow：suspend（attentionId、question、options、resumeLabel）
③ 人回答：事务内 Attention open→answered（条件更新，重复 409）→ resume(runId, resumeData)
④ 超时：Passes 扫描 dueAt → expired → 生成 24h 复查关注 → run.cancel()
⑤ 串行：Attention 唯一约束与工单锁，不依赖 workflow
```

默认时限：关注 72 小时、升级与停滞复查 24 小时、提醒窗口 12 小时。

### 4.5 恢复与幂等

- 事件幂等：spaceId 与 dedupeKey 唯一；
- 线程互斥：Redis 锁 + 唯一约束兜底；
- 派工恢复：租约过期标记中断 → 新 assignment 带恢复说明；
- 执行恢复：durable 快照 + 工具业务幂等键，不使用 toolCallId；
- 外部写：Effect 账本先登记、提交后执行、崩溃窗口对账；
- 终态幂等：条件更新 + 唯一约束。

### 4.6 事务边界

| 动作          | 事务内                                                      | 事务外               |
| ------------- | ----------------------------------------------------------- | -------------------- |
| accept        | Decision 关联、Mandate、Ticket、Subscription、首 Assignment | 派工入队、审计       |
| 回答关注      | Attention 状态、回答、审计                                  | resume 会话、通知    |
| 产物确认/回滚 | 版本分配、状态迁移、审计                                    | 写回效果、后续工作流 |
| 外部写        | 回执与幂等键                                                | Effect 执行 → Outbox |
| 结束/重开     | 状态、原因、审计                                            | 通知、后续           |

## 五、技术方案

### 5.1 选型

| 层           | 技术                                | 作用                         |
| ------------ | ----------------------------------- | ---------------------------- |
| 业务 API     | NestJS + zod                        | HTTP、校验、权限守卫、DI     |
| 后台进程     | Node worker + BullMQ                | 队列消费、效果执行、周期扫描 |
| 存储         | PostgreSQL + Prisma                 | 业务事实、策略、审计         |
| 缓存/队列    | Redis                               | 队列、锁、限流、缓存         |
| Agent 运行时 | Mastra 1.83（durable / evented）    | Agent 回合、持久执行、工作区 |
| 控制台       | Next.js App Router + TanStack Query | 只读投影与轻操作             |

### 5.2 进程与部署

| 进程   | 入口      | 职责                                             |
| ------ | --------- | ------------------------------------------------ |
| api    | HTTP 入口 | 对外接口、面板、管理、内部契约                   |
| worker | 队列入口  | Engine 推进、调度、Session 执行、Effects、Passes |

api 与 worker 同镜像双入口；单实例为 V0 前提。多副本需要共享 PubSub 与运行租约，见第十一节。

### 5.3 队列与调度

队列拓扑：

| 队列           | 用途                     | 并发与顺序                  |
| -------------- | ------------------------ | --------------------------- |
| triage.pending | 线程锁、合批、Assessment | 同 thread 串行              |
| accept.pending | 建单事务                 | 唯一约束                    |
| assign.pending | 派工执行                 | 同 ticket 单活跃 assignment |
| effect.pending | Outbox 投递、写回、告警  | 同会话保序                  |
| notify.pending | 提醒、卡片               | 低优先级                    |
| dead-letter    | 未知失败人工对账         | 只读                        |

调度器是单逻辑组件，处理所有 Trigger 派生的阶段工作，不按 Source 拆实例：

1. 优先级类：interactive（人正在等）> normal > background。
2. 公平：按 Space 的 deficit round robin，防止单空间饿死其他空间。
3. 互斥：同一 Thread 单 Eval；同一 Ticket 单活跃 Assignment，租约与唯一约束双保险。
4. 租约：worker 心跳续租，过期回收并触发恢复。
5. 水位：积压高时延迟派发、暂停后台任务并告警；入口仅在硬水位拒绝或断开。
6. 重试：错误分类（可重试/永久/未知），指数退避与抖动，未知进 dead-letter。
7. 原则：事务内只入队，提交后执行；暂停时保留待执行记录。

V0 调度参数（可配置，单位为默认值）：

| 参数                   | 默认值                     | 说明                           |
| ---------------------- | -------------------------- | ------------------------------ |
| 线程锁 TTL / 续租      | 60s / 20s                  | 锁值校验释放，唯一约束兜底     |
| Assignment 租约 / 心跳 | 60s / 20s                  | 过期回收并触发恢复             |
| 单批合批上限           | 50 条                      | 同线程同空间                   |
| DRR 量子               | 8                          | 每轮每空间最多派发             |
| 水位（单空间 / 全局）  | 1,000 / 10,000             | 超阈值延迟派发、暂停后台并告警 |
| 可重试退避             | 1s 起，上限 5min，抖动 20% | 错误分类后指数退避             |
| dead-letter            | 重试 5 次或未知错误        | 人工对账，不自动重放           |
| 效果投递               | 30/60/120/240s，最多 5 次  | 与 05 产物与出站一致           |

调度器不承担 provider 配额；配额与限流归 model-gateway，调度器只消费容量与降级信号。

### 5.4 并发与一致性

| 场景     | 机制                                                 |
| -------- | ---------------------------------------------------- |
| 接单     | 单事务写 Decision 关联、工单、授权、订阅、首个派工   |
| 事件幂等 | spaceId 与 dedupeKey 唯一；重复接收返回 duplicate    |
| 线程互斥 | Redis 锁（TTL + 值校验释放）；锁内合批；唯一约束兜底 |
| 工单状态 | 条件更新；终态幂等；同工单闸门串行                   |
| 派工     | 部分唯一索引保证单活跃绑定；执行运行标识唯一         |
| 产物版本 | 工单、类型、版本唯一；事务内分配版本号               |
| 外部写   | 幂等账本与回执表；崩溃窗口可对账                     |
| 暂停恢复 | 暂停不丢事件；恢复后按当前策略复核                   |

### 5.5 执行宿主：AgentSpec / Session / Workspace

| 概念      | 内容                                                     | 生命周期               |
| --------- | -------------------------------------------------------- | ---------------------- |
| AgentSpec | 模型档位、提示词版本、工具白名单、权限、限制             | 长期、可版本化、可复用 |
| Session   | AgentSpec 的一次运行实例：上下文、消息、回合、后台任务   | 随 assignment，可恢复  |
| Workspace | 一个 assignment 的目录、环境变量、并发槽位，运行在沙箱中 | 随 assignment          |

规则：AgentSpec 决定谁来做，Session 决定做到哪，Workspace 决定在哪做。Executor 只依赖端口，不依赖具体 Agent 实现。

Mastra 装配约束：

- 进程内只装配一个 Mastra 实例；模型网关以实例形式注册，键为 `cip`；
- 执行器使用 durable 或 evented agent，运行标识即 assignment 的执行标识；
- 记忆只作可重放缓存：threadId 与 assignment 绑定，resourceId 带 spaceId 与 ticketId，记忆作用域为 thread；
- 工作区与沙箱按 assignment 解析：一 assignment 一目录一沙箱；沙箱默认不开放宿主能力；
- 人工等待使用 suspend / resume，业务状态仍以 Attention 表为唯一事实源；
- 不启用模型驱动的多智能体路由；执行器内部可按 AgentSpec 开启受限的子代理委派，子代理能力必须是父级能力令牌的子集；
- 不使用外部观测 SDK；traceId 由我方生成并注入运行时，审计以业务表为准。

V0 装配参数（版本以仓库锁定为准）：

| 项       | 值                                                                             |
| -------- | ------------------------------------------------------------------------------ |
| 版本     | @mastra/core 1.83、@mastra/memory 1.41、@mastra/pg 1.36                        |
| 实例     | 进程内单实例；`gateways: { cip: instance }`，不可重复 new                      |
| 迁移     | `disableInit: true`；DDL 由 `exportSchemas('mastra')` 生成并进迁移             |
| Agent    | durable / evented；`maxSteps` 40；结构化输出用 `structuredOutput`              |
| 清理     | `cleanupTimeout` 30s；关闭时释放 replay cache                                  |
| 记忆     | workingMemory + semanticRecall；scope `thread`；resourceId 含 spaceId/ticketId |
| 错误处理 | 显式 error processors；工具错误按可重试/永久分类                               |

### 5.6 外部依赖边界

本域不设计模型网关与身份访问：

- 模型调用：本域只声明档位（fast / main / judge）并解析为逻辑模型；provider、候选链、限流、429、失败转移、计量与成本归 model-gateway（见 PRD-MODEL-GATEWAY）；调度器只消费其容量与降级信号，不实现 provider 配额。
- 身份与授权：用户、角色、权限点、Space、成员、能力令牌契约归 iam（见 PRD-IAM）；本域只持有 spaceId，经 iam 的判定入口做动作与数据判定。
- 跨域只经导出服务与契约；不复制对方数据模型，不做跨域外键。

### 5.7 权限与安全边界

本域不定义身份、角色、Space 与授权机制（见 PRD-IAM），只消费其判定入口并声明自身资源权限点：

- 动作权限：`agentic.ticket:read`、`agentic.ticket:update`、`agentic.attention:update`、`agentic.artifact:create`、`agentic.source:update`、`agentic.policy:update`、`agentic.audit:read`、`agentic.agent:update`；命名与动作词规范由 iam PRD 定义，本域不重复定义。
- 数据可见性：查询必须带 spaceId 谓词，可见性由 iam 判定；越界按不存在处理。
- 能力令牌：派工时由 Engine 经 iam 签发（契约见 PRD-IAM），绑定 assignment、spaceId、ticketId、工具白名单与有效期；工具调用必须校验并再判定资源；子代理只取父级子集。
- 输入不可信：消息、引用一律视为数据；密钥只存引用，不进上下文；出站受 SSRF 策略约束。

### 5.8 可观测与 Watchdog

- 审计：每次运行记录 actor、AgentSpec、mandate、策略版本、依据、产物、用量、结果、traceId；工具入参与结果按脱敏规则记录。
- traceId 由我方生成并注入运行时；TraceSink 写 trace_span 与 audit_logs，不依赖外部观测协议。
- trace_span 字段：traceId、spanId、parentSpanId、kind（agent/tool/workflow/session）、name、status、startedAt、endedAt、attributes（JSON，按脱敏规则）、errorCode、attempt；与 audit_logs 用 traceId 关联。
- 指标：事件吞吐、运行数/结果、token 用量、出站结果、运行时长、积压、队列等待。
- Watchdog：评估超时重入队、派工中断恢复、效果连续失败健康、关注过期升级、来源连续失败暂停。
- Panel 只展示需要人的、系统健康的、历史三类信息。

### 5.9 容量、限流与降级

- 单实例容量按事件/秒、并发会话数、队列积压、数据库连接四维设上限。
- 入口只做廉价持久化与入队；限流只做硬水位保护，正常突发由调度器吸收。
- 降级：模型不可用 → 研判 unavailable / 执行转人工；Redis 不可用 → 锁降级放行并告警；数据库不可用 → 停止消费。
- 不设单次执行的 token、时长或工具次数上限；用停滞检测、取消、成本可观测与组织级配额策略控制风险。

### 5.10 技术难点与取舍

| 难点             | 取舍                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| 多副本一致性     | V0 单实例；Mastra 运行租约与写栅栏只在 Mastra 执行内生效，不替代 Engine 条件更新 |
| 长任务与后台工作 | 回合与后台任务分离；停滞检测介入，不设业务预算上限                               |
| 输入不可信       | 授权只来自 Mandate、Policy 与能力令牌；正文与引用一律视为数据                    |
| 成本控制         | 成本可观测与告警、组织级配额策略；不砍单次执行                                   |
| 恢复正确性       | 工具幂等、外部写账本、恢复说明；不承诺重放即安全                                 |
| 观察模式         | 主动能力先 observe 只记录，再切 auto                                             |

## 六、文件结构与模块职责

### 6.1 仓库结构

```
apps/api/src/
├── main.ts / worker.ts / app.module.ts / worker.module.ts
├── platform/      # prisma、redis、queue、http、crypto、table-query、trace
├── pipeline/      # guards、pipes、filters、audit、call-context、rate-limit
├── openapi/       # 契约生成
└── modules/
    └── agentic/          # iam、model-gateway 为独立模块，见各自 PRD
apps/web/
├── app/(workspace)/            # 页面路由
├── features/                   # 垂直切片
└── lib/api-client/             # 生成的 client
packages/shared/src/
└── agentic/                    # 本域枚举、事件信封、队列名
```

### 6.2 agentic 模块

```
modules/agentic/
├── agentic.module.ts
├── ticket.controller.ts / thread.controller.ts / attention.controller.ts
├── policy.controller.ts / source.controller.ts / audit.controller.ts / internal.controller.ts
├── dto/
├── domain/
│   ├── task/        trigger、thread、decision、ticket、mandate、subscription、assignment
│   ├── attention/   attention 与升级规则
│   ├── artifact/    artifact、effect、outbox 回执
│   ├── policy/      gate 与 assessment 规则、策略版本
│   └── port/        repository、source-scope、assessor、executor、session、workspace、channel、outbox
├── application/
│   ├── engine/      intake / evals / tickets / assignments / replies
│   ├── scheduler/   dispatcher、queue、priority、fairness、lease、watermark、retry
│   ├── passes/      到期、提醒、停滞、恢复、对账
│   ├── runtime/     组合根、Mastra 装配、启停
│   ├── notices/     候选、报告、关注送达会话
│   ├── outbox/      回执、重试、Channel 调度
│   └── setup/       环境与账号准备
└── infrastructure/
    ├── persistence/   Prisma Store
    ├── effects/       BullMQ 效果队列
    ├── sources/lark/  source、translate、channel、schema
    ├── executor/      执行端口适配
    │   ├── session/   session、delivery、turn
    │   └── workspace/ workspace、sandbox、slots、recovery
    ├── runtime/
    │   ├── agents/    AgentSpec 定义
    │   ├── workflows/ 确定性工作流
    │   ├── tools/     工具定义
    │   └── scorers/   评分与回归
    └── channels/      多来源共用发送实现时才建
```

### 6.3 外部模块边界

iam 与 model-gateway 是独立模块，其目录、领域模型、数据表与接口见各自 PRD（PRD-IAM、PRD-MODEL-GATEWAY）；本域只经导出服务依赖，不 import 其内部文件，不复制其数据模型。

### 6.4 分层与依赖

| 层         | 目录             | 允许依赖                       |
| ---------- | ---------------- | ------------------------------ |
| 接入层     | controller / dto | 应用层                         |
| 应用层     | application      | 领域层；不 import 基础设施     |
| 领域层     | domain           | 无框架依赖；只依赖 shared      |
| 基础设施层 | infrastructure   | 实现领域端口；不反向依赖应用层 |

跨模块只经导出的应用服务或领域事件；AgentSpec、Session、Source 不得直接写领域表。

### 6.5 命名约定

- 飞书统一 lark；出站叫 channels；
- 执行者规格叫 AgentSpec，目录 `infrastructure/runtime/agents/<key>/<key>.agent.ts`；
- 运行实例能力叫 session（单数）；执行环境叫 workspace；
- 数据可见性边界叫 Space；旧 scopeKey 只在兼容说明中出现；
- 本域表名使用登记前缀 agentic_；iam_、model_gateway_、audit_ 属各自上下文，见对应 PRD。

## 七、数据模型

### 7.1 Schema 布局

```
public   平台表与本域 agentic_* 表（本 PRD 只展开本域）
mastra   Mastra 自有表（独立 schema，运行时禁止自动建表）
```

Mastra 表由运行时导出 DDL，进入独立迁移；业务表由 Prisma 管理，两者不做跨 schema 外键，只用标识引用。归档暂不单独建 schema，按保留策略清理。

### 7.2 表清单

| 上下文  | 前缀     | 表                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| agentic | agentic_ | agentic_source_instances、agentic_source_authorizations、agentic_source_health、agentic_triggers、agentic_threads、agentic_reply_targets、agentic_policies、agentic_admission_rules、agentic_decisions、agentic_decision_triggers、agentic_tickets、agentic_mandates、agentic_assignments、agentic_subscriptions、agentic_attentions、agentic_reports、agentic_artifacts、agentic_effects、agentic_outbound_messages、agentic_trace_spans |
| mastra  | mastra_  | 运行时自有（线程、消息、工作流快照、评分等）                                                                                                                                                                                                                                                                                                                                                                                              |

本 PRD 不登记 iam_、model_gateway_、audit_ 表；这些表属各自上下文（见 PRD-IAM、PRD-MODEL-GATEWAY 与平台审计），本域只用标识引用，不做跨域外键。

### 7.3 约束与索引

| 约束                                        | 目的                       |
| ------------------------------------------- | -------------------------- |
| （spaceId、sourceType、externalKey）唯一    | 同一空间内一个对象一个线程 |
| （spaceId、dedupeKey）唯一                  | 事件幂等                   |
| outbound_messages.idempotencyKey 唯一       | 出站幂等                   |
| subscriptions（ticketId、threadId）联合主键 | 防重复订阅                 |
| artifacts（ticketId、kind、version）唯一    | 版本链唯一                 |
| attentions.assignee 与 deadline 非空        | 关注有等待对象与时限       |
| assignments 单活跃绑定的部分唯一索引        | 同工单单活跃派工           |

索引最小集：triggers(threadId, occurredAt)、tickets(spaceId, status)、attentions(status, deadline)、outbound_messages(status, nextAttemptAt)、assignments(executorRunId)。

### 7.4 保留与归档

事件 90 天归档；出站成功 30 天清理；报告 180 天；决策、授权、产物永久；审计长期保留。删除只清终态且需显式开关与确认串。

## 八、接口与契约

### 8.1 HTTP 接口

路径约定：本域接口统一以 `/agentic/` 开头；iam 与 model-gateway 的接口与权限见各自 PRD。页面路由按 ADR-0080，首段与本域同名：`/agentic/{tickets,threads,attention,console/*}`。

| 域   | 接口                                           | 权限                                                    |
| ---- | ---------------------------------------------- | ------------------------------------------------------- |
| 来源 | 来源实例增改查/启停/健康；授权增删查；回调入口 | agentic.source:update；回调验签                         |
| 工单 | 列表/详情/时间线；结束/重开；线程列表/详情     | agentic.ticket:read / agentic.ticket:update             |
| 关注 | 待办列表；回答关注                             | agentic.ticket:read / agentic.attention:update          |
| 产物 | 产物回滚；写回撤销                             | agentic.artifact:create；撤销另需 agentic.ticket:update |
| 策略 | 策略与准入规则读写                             | agentic.policy:update                                   |
| 审计 | 审计列表；按 traceId 回放                      | agentic.audit:read                                      |
| 回归 | Agent 回归触发与结果                           | agentic.agent:update                                    |
| 面板 | 候选/评估/执行/设置只读视图                    | 对应权限点                                              |

### 8.2 内部契约

`/internal/runs`、`/internal/reports`、`/internal/artifacts`、`/internal/effects/reconcile`、`/internal/metrics`、`/internal/retention[/apply]`；使用能力令牌鉴权，叠加能力、范围与时间窗；拒绝写审计。

### 8.3 队列契约

效果队列按 kind 与 key 唯一；评估、派工、投递、回写、通知分别定义重试策略；提交后执行；暂停时保留。

### 8.4 Source 契约

| 部分                                 | 必选 | 约束                                                                         |
| ------------------------------------ | ---- | ---------------------------------------------------------------------------- |
| kind / 配置 schema / fields / health | 是   | kind 稳定；默认配置收不到事件                                                |
| 事件翻译                             | 是   | 稳定 id、线程键、actor、human/addressed、channel、meta；自身消息不产 Trigger |
| scope                                | 是   | 只看 meta 与配置；范围外交 Engine 记为 filtered                              |
| channel（send/allowed/link）         | 是   | 按消息 id 幂等；仅永久不可达返回 gone                                        |
| Policy 部分                          | 是   | 名单、准入行、bot 名单；不跨源映射身份                                       |
| environment                          | 否   | 只传事实，不传凭据                                                           |
| 生命周期                             | 是   | 等 setup、跟随开关、abort、连续失败才报 error                                |

本设计只接入飞书消息与卡片动作，不读取多维表格，不维护表格游标。

### 8.5 AgentSpec / Session / Workspace 契约

| 接口          | 方法                                                  | 约束                       |
| ------------- | ----------------------------------------------------- | -------------------------- |
| ExecutorPort  | start / deliver / stop                                | 一工单一会话一目录；可恢复 |
| SessionPort   | open / resume / deliver / onTurnEnded / close         | 只经 Engine 回调写状态     |
| WorkspacePort | prepare / variables / acquireSlot / release           | 目录与环境隔离；失败可重试 |
| AgentSpec     | key、model、promptVersion、tools、permissions、limits | 不含凭据；变更需审计       |

### 8.6 错误与幂等

统一 problem+json，保留 code、status 与 traceId；重复接收返回 duplicate；幂等冲突与已关闭关注返回 409；列表稳定排序、有界分页。资源不可见统一 404，缺动作权限 403。

## 九、扩展与接入

### 9.1 本期范围

本期实现飞书 Source 与 router / worker 两个 AgentSpec；其余来源与业务能力属于扩展方向。

### 9.2 新增业务系统（Source）

1. 映射事件、线程、actor、Channel 地址与接收范围；
2. 实现配置 schema、fields 与 health；
3. 翻译事件为 Trigger（稳定 id、过滤自身消息）；
4. 实现 scope 与 Policy 名单；
5. 实现 Channel 发送（幂等、gone 语义）；
6. 注册执行环境变量；
7. 写循环：等 setup、跟随开关、abort、单条错误不拖垮整批；
8. 跑 Source 一致性测试。

### 9.3 新增业务能力（AgentSpec）

1. 写 `runtime/agents/<key>/<key>.agent.ts`：模型档位、提示词版本、工具、权限、限制；
2. 提示词与工具进入版本管理；
3. 在 Policy 中声明何时使用该 AgentSpec；
4. 需要新工具时实现工具契约（权限、幂等、范围过滤）；
5. 跑 Agent 回归与工单端到端验收。

### 9.4 演进方向（不在本期）

- 身份与授权扩展：跨空间共享、委派或文档级授权属 iam 的演进方向，见 PRD-IAM；本域不设计。
- 知识库：本期不设计、不预留表结构；需要时另立设计。
- 子代理委派：执行器内部可按 AgentSpec 开启受限子代理，能力必须是父级令牌的子集。

## 十、部署与运维

### 10.1 部署拓扑

```
[公网] 飞书开放平台（长连接或回调）
[DMZ] 出站代理（白名单、审计、限流）
[内网] api（HTTP）  worker（队列 / Engine / 调度 / Session / 周期扫描）
       PostgreSQL（业务 + 审计 + Mastra schema）  Redis（队列 / 锁 / 限流）
       模型服务（供应商或私有网关）
```

### 10.2 配置

| 变量                                                                     | 作用                       |
| ------------------------------------------------------------------------ | -------------------------- |
| DATABASE_URL / REDIS_URL                                                 | 存储与队列                 |
| LARK_APP_ID / LARK_APP_SECRET、LARK_VERIFICATION_TOKEN、LARK_ENCRYPT_KEY | 飞书接入                   |
| INGRESS_RATE_PER_SECOND / OUTBOUND_RATE_PER_SECOND                       | 入站与出站限流             |
| AGENTIC_RETENTION_APPLY                                                  | 保留清理开关               |
| SANDBOX_DRIVER                                                           | 沙箱实现选择               |
| OUTBOUND_ALLOW_PRIVATE_HOSTS                                             | 出站私网豁免（默认全阻断） |

运行参数、模型档位、灰度与告警目标由策略配置提供。

### 10.3 发布与回滚

按来源、空间、AgentSpec、工单灰度；未命中回退同步路径；回滚只切开关，不回滚数据库。规范变更与迁移同批发布，回滚以迁移与开关配套。

### 10.4 备份与演练

业务表每日全量加增量保留 30 天；恢复后先校验工单状态、未完成 Assignment 与账本未重复执行；定期做恢复演练。

### 10.5 测试策略

| 层级 | 覆盖                                                      |
| ---- | --------------------------------------------------------- |
| 单元 | 领域不变量、状态迁移、权限拒绝                            |
| 契约 | Source 一致性、AgentSpec/Session/Workspace 契约、内部接口 |
| 集成 | 回调到研判、建单、执行、回写；关注并发；出站幂等          |
| 回放 | 按 traceId 还原运行与依据                                 |
| 权限 | 越权读取/写回、能力令牌范围与时间窗                       |
| 压测 | 入站并发、同键幂等、闸门锁、队列积压                      |

命令与门禁唯一来源：`docs/reference/verification.md`。

## 十一、设计边界、风险与待决项

| 项                     | 边界或风险                                                 |
| ---------------------- | ---------------------------------------------------------- |
| 多副本运行归属与写栅栏 | V0 单实例；Mastra 租约只覆盖执行，不覆盖业务写             |
| 流式输出               | 由 Channel 承担；领域只保证幂等与顺序                      |
| 长任务与后台工作       | 回合与后台任务分离；以停滞检测、取消与成本告警替代预算上限 |
| 输入不可信             | 正文、引用一律视为数据；授权只来自 Mandate、Policy 与令牌  |
| 外部授权能力           | 身份、Space 与授权由 iam 承载；本域只消费判定入口          |
| 知识库                 | 不在本期，不预留表与令牌字段                               |
| 代码执行               | 不在本期；未来以工具与人工确认接入                         |
| 子代理委派             | 仅执行器内部、按 AgentSpec 开启，能力必须子集化            |

## 十二、变更记录

| 日期       | 变更                                                      | 原因     | 作者 |
| ---------- | --------------------------------------------------------- | -------- | ---- |
| 2026-11-17 | 目标设计重写：Space 边界、调度器、Mastra 执行面、模型网关 | 架构对齐 | lead |
