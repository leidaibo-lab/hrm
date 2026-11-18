# ADR-0014 api 统一 DDD 领域分层

> 状态：已接受（目录名部分被 0018、映射影响面部分被 0023 取代） · 日期：2026-11-02 · 级别：L3

## 决定

api 统一采用 DDD 领域分层：业务模块内部分为 `domain/`（实体：类 + 行为、repository 接口、领域事件）、`application/`（`*.service.ts` 应用服务：方法即用例、事务边界、资源级权限）、`infrastructure/`（repository 的 Prisma 实现与 mapper）；接入层（controller / dto）与契约管线不变。全局 `infra/` 更名 `adapters/`（技术能力适配器），消除与模块内 `infrastructure/` 的命名歧义。可判定依赖规则：`domain/` 禁止 import `@nestjs/*` 与 `@prisma/client`；`adapters/` 禁止 import `modules/`；实体状态变更必须经实体方法。`health` 等无领域逻辑的运维端点豁免领域层，保持 controller-only。实施分期：P0 文档基线 → P1 目录改名（独立提交）→ P2 存量迁移（iam → auth，每模块独立提交，OpenAPI diff 必须为空）→ 新模块直接套用。细则与防退化取舍见附录。

## 被否决的选项

- 维持「controller + service + dto」单一形态、按复杂度判据按需升级：决策偏好全员统一的结构一致性，判据初值未经检验且为每次评审增加判断成本。
- 整体引入教科书 DDD（每操作 usecase 类、查询强制装载聚合、值对象普遍化）：薄域样板税过高，iam 类 CRUD 的用例层退化为纯转发；以 service 单元 + CQRS-lite 读模型豁免压缩成本。
- 整体 Clean NestJS 四层（controller → usecase → domain → infra）：同样存在薄域转发层税，且领域词汇不如 DDD 直接。
- 模块内 `infrastructure/` 改名 `persistence/` 消歧：端口实现将来含非持久化内容（如飞书 AuthProvider 实现、事件发布器），`persistence/` 会名不副实；DDD 标准层名优先，改为更名全局 `infra/`（其文档定义本就是「技术能力适配器」，`adapters/` 更准确）。

## 后果

- 每聚合约 5 个文件（实体、repository 接口、应用服务、实现、mapper），iam 全量约 25–30 文件；mapper 是 Prisma schema 变更的唯一联动点。
- 薄域应用层存在薄转发，属统一性的既定成本（决策偏好支付）。
- `architecture.md` 改写后细则下沉本附录，现行文档篇数不变（14）。
- 重武器（每操作 usecase 类、CQRS 命令总线、saga、事件溯源）暂不引入，触发判据见附录 B；判据为初值，首个厚域（预计飞书回调或 Agent）落地时按本 ADR 修订。
- P1 改名需同步 `verification.md` 中 prisma generated 产物路径；存量测试在 P2 迁移中保持绿的义务优先于结构美观。

## 附录 A：分层与依赖规则

| 层                  | 职责                                                         | 硬规则                                     |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| 接入层              | controller + zod DTO + OpenAPI                               | 契约唯一边界，领域模型不出现在契约         |
| `application/`      | 编排、事务、资源级权限                                       | 实体状态变更必须经实体方法，禁止外部改字段 |
| `domain/`           | 实体行为、不变量、领域事件                                   | 禁止 import `@nestjs/*`、`@prisma/client`  |
| `infrastructure/`   | 持久化细节、mapper                                           | 只实现 domain 接口 + 消费 `adapters/`      |
| `adapters/`（全局） | 技术能力：prisma、redis、队列、对象存储、HTTP、模型 provider | 禁止 import `modules/`                     |
| `common/`（全局）   | 请求管线机制                                                 | 现行规则不变                               |

## 附录 B：防退化取舍与重武器判据

1. 应用服务保留 `*.service.ts` 单元（方法即用例），禁止每操作拆 usecase 类。
2. CQRS-lite：命令走聚合装载；查询允许 repository 直返读模型，读写双通道在同一接口内明示。
3. 值对象仅当字段自带校验/行为时建（如 Email），裸 string/number 不包。
4. 领域事件用 Nest `EventEmitter2` 进程内实现；跨进程才引入 BullMQ。
5. 事务边界在 application 方法，经 `adapters/` Prisma 适配器交互式事务回调开启，事务句柄不进 domain 接口签名。
6. 重武器触发判据（命中任一才可引入附录「暂不引入清单」项，并落模块级 ADR）：① 存在单条校验 + 单事务无法表达的跨操作复合不变量；② 存在需显式建模非法迁移的状态机；③ 多聚合一致性需领域事件协调且事件已有真实跨模块订阅者。未命中判据的模块禁止预建上述项。

## 附录 C：实施分期与回滚

- P0 文档基线：本 ADR + `architecture.md` 改写 + `authorization.md` 措辞对齐 + `index.md` 事实更新；纯文档。
- P1 目录改名：`git mv infra adapters` + 全部 import 路径替换（含 prisma generator 输出路径与重新 generate）+ `verification.md`、`index.md` 路径同步；独立提交。
- P2 存量迁移：iam → auth，每模块独立提交；迁移后单测保持绿、OpenAPI diff 为空；`health` 豁免不迁。
- 新模块（飞书 / Agent）直接按新形态落地，首个厚域即判据与模板的检验点。
- 回滚：P0 / P1 / P2 各自独立提交，逐个 revert 即完整还原；无数据迁移、无 CI 结构变更。
