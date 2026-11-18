# 命名规范

> 层：规范 · 时态：约束未来 · 失效：角色表、命名模型变更时

## 目的

让文件名、函数名、类型名可预测：新增业务域只能复用既有角色，**不扩后缀表**。目录与分层见 `architecture.md`，本文件不重复目录矩阵。

## 何时读取

新建 / 重命名任何 `apps/api/src` 源文件、新增 application service 或方法、新增业务模块目录时。

## 适用范围 / 不适用

- 适用：API 手写代码；Web 命名见本文件「前端命名」；生成产物与 vendor 目录除外。
- 不适用：Prisma model / 字段命名（见 `persistence.md`）；`packages/shared` barrel 约定。

## 一、文件命名模型

`<resource>[.<technology>].<role>.ts`，`role` 永远是最后一段。

1. `resource`：kebab-case 单数领域名词；不得与角色词重复。
2. `technology`：仅端口实现使用 `prisma | redis | memory`，固定在中间。
3. `role`：只能取下方**通用 18 项**封闭表；`runtime/` 执行层另取**runtime 执行角色 4 项**（全局封闭，见下）。**新增或调整任一层角色，必须同改对应表 + 白名单测试 + ADR**。 `NAM-4.1`
4. 模块入口必须 `<所属目录名>.module.ts`，根 `app.module.ts` 除外；禁止 `index.module.ts`。模块 / 能力本体文件重复目录名：`iam/iam.module.ts`、`platform/redis/redis.service.ts`；子特性文件不重复目录名：`openapi/schema.helper.ts`。模块目录名可取领域复合词（如 `model-gateway`），但文件名角色仍按 18 项，`gateway` 不得作为文件名角色。
5. 豁免（白名单测试同步放行）：`main.ts`、`app.module.ts`、`config/env.ts`、各层 `index.ts`（barrel）、`platform/prisma/generated/**`。

| 组     | 角色（18，业务域封闭）                                                      |
| ------ | --------------------------------------------------------------------------- |
| 核心 8 | `module` `controller` `dto` `service` `entity` `repository` `port` `mapper` |
| 管线 5 | `guard` `interceptor` `pipe` `filter` `decorator`                           |
| 支撑 3 | `error` `type` `helper`                                                     |
| 测试 2 | `spec` `fixture`                                                            |

**runtime 执行角色（4 项，全局封闭）**

| 角色       | 用途                 | 允许目录                                      |
| ---------- | -------------------- | --------------------------------------------- |
| `agent`    | Mastra Agent 定义    | `modules/*/infrastructure/runtime/agents/`    |
| `workflow` | Mastra Workflow 定义 | `modules/*/infrastructure/runtime/workflows/` |
| `tool`     | Mastra Tool 定义     | `modules/*/infrastructure/runtime/tools/`     |
| `scorer`   | Mastra Scorer 定义   | `modules/*/infrastructure/runtime/scorers/`   |

两层封闭表的边界：

- 通用 18 项是业务域唯一可用的后缀：**业务域不得新增后缀**，领域名词只能进 `resource` 段（如 `lark-card.service.ts`），禁止 `lark.card.ts`。
- runtime 4 项跨域共用同一套，不随域派生（不存在「agentic 的 agent」「connector 的 connector」）；只在 `runtime/` 对应子目录内有效，其它目录出现即违规，见 ADR-0044。
- 新增/调整任一层角色，必须同改对应表、白名单测试与 ADR；ADR 需写明改动属于通用角色还是 runtime 角色。

`helper` / `type` 仅允许出现在 `pipeline/`、`openapi/`、`testing/`、模块 `infrastructure/`；**`domain/` 禁止**——领域层只放可命名的领域概念，纯函数必须收敛为实体 / 值对象方法。 `NAM-4.2`

模块根 guard 必须是 `<域>.guard.ts`（如 `auth/auth.guard.ts`）。

已删除的写法（禁止再出现）：`provider`（用 `service`）、`projection`（用 `repository`）、`client` / `gateway` / `factory` / `limiter` / `metering` / `store`（技术词进文件名前缀，角色用 `service` 或 `helper`）、`exception-filter`（用 `filter`）。 `NAM-4.3`

模块 `infrastructure/*.service.ts` 是端口 / 技术适配器实现（网关、外部目录客户端等），不是应用服务；应用服务只在 `application/`。

## 二、函数与方法命名

- 函数 / 方法必须取下表前缀，前缀与语义一一对应，不得跨语义复用。 `NAM-5.1`

| 语义     | 允许前缀                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| 查询     | `get*`（必得，失败抛）/ `find*`（可空）/ `list*`（集合）/ `exists*`（布尔）/ `probe*`（健康探测，失败返回 false） |
| 写入     | `create*` / `update*` / `set*`（子集合全量替换）/ `save*` / `remove*`                                             |
| 断言     | `assert*`（应用层前置）/ `ensure*`（领域不变量）/ `must*`（私有装载并抛）                                         |
| 转换     | `to*` / `build*` / `resolve*` / `apply*`（原地变换并返回）                                                        |
| 谓词     | `is*` / `has*` / `can*`                                                                                           |
| 生命周期 | `on*`（框架钩子）                                                                                                 |

禁止：`delete`（用 `remove`）、`check`（用 `probe` / `is`）、`xxxExists`（用 `existsByXxx`）、`fetch`（仅网络调用可用）、`handle` / `process` / `do`。

- 标识符（函数 / 方法、类型、字段、参数、DTO 属性）禁止以 `Ref` 结尾，也禁止 `ref` / `refs` 作为独立标识符；外部对象映射用 `Binding` 或 `Link`，标识引用用 `Id` / `Key` / `Name`。Web 的 React `useRef` 局部变量不适用本条。 `NAM-5.2`

测试文件（`__tests__/`）与测试夹具内的辅助工厂、替身构造函数豁免前缀表（如 `makeXxxRow`、`handlerXxx`）；业务源码无此豁免。

- controller 方法：`list` / `get` / `create` / `update` / `remove` + 子资源动作（`setStatus`、`testConnection`、`createPricing`）。
- 实体 getter：裸名词（`status`、`roleIds`、`enabled`、`slug`）；布尔用 `is*`；私有字段用 `#` 私有字段避免同名。

## 三、类型 / 常量

- HTTP 入参：`CreateXxxDto` / `UpdateXxxDto` / `SetXxxDto` / `XxxQueryDto`；
- HTTP 出参：`XxxViewDto`；动作结果：`XxxResultDto`；
- 域读模型：`XxxView`；投影行：`XxxRow`；端口：`XxxRepository` / `XxxPort`；
- 常量 UPPER_SNAKE（模块内）或 `xxxSchema`（schema 常量）；类 PascalCase。

## 四、违规示例

| 写法                                              | 违规点                           | 正确做法                                   |
| ------------------------------------------------- | -------------------------------- | ------------------------------------------ |
| `platform/redis/redis.helper.ts`                  | platform 只允许 module / service | 并入 `redis.service.ts`                    |
| `pipeline/audit/audit-manager.ts`                 | `manager` 不在角色表             | 归入 `.interceptor.ts` / `.service.ts`     |
| `pipeline/guards/user.guard.ts`                   | 域特定管线组件                   | 放 `modules/<域>/<域>.guard.ts`            |
| `iam/domain/role.projection.ts`                   | 已删除后缀                       | `role.repository.ts`                       |
| `auth/session.guard.ts`                           | 模块根 guard 必须用域名词        | `auth/auth.guard.ts`                       |
| `auth/infrastructure/redis-session.repository.ts` | 技术段顺序错                     | `session.redis.repository.ts`              |
| `resolveRef()` / `GatewayModelRef`                | `Ref` 后缀（NAM-5.2）            | `findGatewayModel()` / `GatewayModelEntry` |

## 五、验证方式

1. `apps/api/src/__tests__/architecture.spec.ts`：按目录断言文件名白名单（含 guard 域名、domain 角色收紧、barrel 位置、runtime 四个执行角色限定）。
2. 新增角色须同时改对应表（通用 / runtime 子表）、白名单测试与 ADR，三者缺一视为不合规。
3. 已删除后缀禁再出现：`scripts/checks/rules.ts` 扫描文件名（经 `pnpm check:rules`）。
4. 函数 / 类型命名除 `NAM-5.2`（`Ref` 命名）外暂无机器检查，属 review 项；机器化方案登记在 `../reference/verification.md`「规则 → 检查映射」的待落地行。

## 前端命名

1. 业务组件文件必须 kebab-case.tsx，组件名 PascalCase；独立 hook 文件必须 use-xxx.ts，组件目录内可用 hooks.ts；框架路由文件按 Next 约定。 `NAM-6.1`
2. feature API 文件按资源命名，query/mutation 可同文件；缓存键统一 api/keys.ts，feature 公开入口 index.ts，目录化组件出口 index.tsx。
3. DTO/schema、读模型/端口、外部原始类型必须分别集中在所属契约或适配器内；禁止逐类型机械拆文件。新增文件必须有真实调用方和独立职责，验证由人工 review。

## 工程脚本

手写工程脚本统一放 scripts/，必须使用 kebab-case.ts，经 tsx 执行，禁止新增 .js/.mjs/.cjs 脚本；共享脚本逻辑放 scripts/checks/lib/，使用同一份 TypeScript 类型，不维护配套声明副本。验证：check:rules 与 tsc -p tsconfig.json。 `NAM-7.1`
