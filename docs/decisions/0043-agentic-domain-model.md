# ADR-0043 agentic 领域模型与授权

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

`agentic` 以十四个概念建模，业务类型（需求、Bug、发布）不是领域实体，而是 Source 的差异与角色的差异。

| 概念         | 职责                                              |
| ------------ | ------------------------------------------------- |
| Source       | 事件流；adapter 是类型，instance 是一份配置       |
| Trigger      | 不可变事件，幂等单元                              |
| Thread       | 同一对象的事件流，同一 Thread 同时只跑一个 Eval   |
| Correlation  | Thread 间关系，只补上下文                         |
| Channel      | Thread 的写侧，回复目标                           |
| Policy       | 版本化规则与每个 Source 的准入部分                |
| Eval         | 两层：Gate（确定性准入）与 Assessment（模型研判） |
| Decision     | accept / stop / ignore / unavailable              |
| Mandate      | 授权：范围、强度、策略版本、发起人，不可变        |
| Ticket       | 被授权的工作单元，自有状态                        |
| Assignment   | Ticket 与执行器的绑定，与 Ticket 状态独立         |
| Subscription | Ticket 与 Thread 的多对多，只给上下文、不给授权   |
| Attention    | 等人决定的一等问题，一等公民                      |
| Executor     | 执行端口，域外实现                                |

关键约束：

- **Ticket 与 Mandate 分离**。Mandate 记录“凭什么可以做、能做到哪”；扩大范围必须新开 Ticket；撤回单独记录，不回写 Mandate。
- **只有 Eval 能创建 Ticket**。程序层过滤与模型层研判都不得绕过 Eval 直接开单。
- **Subscription 扇出不校验发送者**，但也不赋予任何授权；授权只来自 Mandate。
- **Ticket 自有状态**，不跟随执行器的会话或运行状态。
- **多项目是 scope，不是新实体**。Source 实例可覆盖多个项目，Thread 键带项目命名空间，Mandate 范围带项目；跨项目协同用多个 Ticket 加 Correlation，禁止跨项目单一 Ticket。
- 数据表统一使用 `agentic_` 前缀，区分本领域、平台既有表与 Mastra 自有表。

## 被否决的选项

- **需求域与 Bug 域各建一套流程**：会复制 Trigger/Thread/授权/闸门，扩展一次改两处。
- **把授权字段塞进 Ticket**：Ticket 可变，授权不可变，混在一起无法回答“当时凭什么批准”。
- **用执行器会话状态代表任务状态**：任务可移交、可恢复、可多次执行，必须自有状态。
- **跨项目单一 Ticket**：Mandate 范围与执行环境无法唯一确定，审计不可归因。
- **把 Attention 做成普通通知**：会丢失“等谁、等到何时、超时怎么办”的约束。

## 后果与回滚

新增 23 张表，V0 启用其中 15 张；表结构、索引与保留策略由 `docs/prd/agentic/data-model.md` 承载。

回滚：停用 `agentic` 写入路径并注销 Eval；只追加表（Trigger、Decision、Mandate、Artifact）保留供审计，可变表停止更新，不做级联删除。
