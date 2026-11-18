# ADR-0055 载荷空值统一为缺省键

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

1. TypeScript 类型声明默认用 `?: T` 表达无值；业务上“不存在”同样用 undefined，不再用 null 表示。`null` 仅允许三类例外：出站序列化要求键存在且值为 null；持久化实体/快照与外部系统原样 NULL；入参需区分“省略”与“主动清空”且已 JSDoc 说明。
2. 出站载荷省略无值键，不再发送显式 null；目标协议不允许省略键时，在出站适配层把 undefined 映射为 null，业务层保持 undefined。
3. 可空字段判空优先布尔，前提是类型不含 `''`、`0`、`false` 等合法 falsey 值，或已由 JSDoc 声明非空不变量；否则用 `!= null`（同时覆盖 null 与 undefined）。
4. 本决定取代 ADR-0004 的「可空字段显式 null，不省略键」子约定；`contracts.md` 载荷子约定与 `code-quality.md` 空值条款同步改写，分别以 CON-4.4、QLT-4.2 落地。

## 被否决的选项

- 保留「可空字段显式 null，不省略键」：响应体冗余，前端需为空值与键缺席各写一套分支；现有消费方没有依赖 null 与缺省的区分。
- 领域实体、持久化快照一并改为 undefined：涉及 146 个 `| null` 字段、Prisma NULL 映射与 175 处测试断言，换不来线上收益；SQL NULL 与外部系统 NULL 属于登记例外。
- 按接口或按格式化换行决定 null/undefined 形态：判据挂在列宽与格式化输出上，同一段逻辑会随改名翻转，无法一致机检。

## 后果

- 响应键可缺席；OpenAPI 对应字段 `required` 变为非必填，兼容性按 CON-7.1 人工复核并保留离线导出 diff。
- Web 侧载荷类型为手写镜像，必须与 api 同批改为 `?:`，否则两端类型漂移不会报错。
- 新增两条规则：QLT-4.2（载荷字段禁止 `| null`）与 CON-4.4（载荷缺省键与出站 null 映射）。机器检查待落地，落地前按人工 review 执行。
- 测试断言从“字段为 null”改为“字段缺席”：`toBeNull()` 改 `toBeUndefined()` 或 `expect('k' in obj).toBe(false)`。

## 迁移清单

存量清单只登记在本 ADR，规范正文不承载会过期的代码清单与路径。

- 允许行为：下表文件内的载荷字段在迁移完成前可继续声明 `| null`；其它新增或修改代码不适用。
- 理由：规则先行、迁移分批，避免规范生效即全仓违规；清单随迁移递减，不得新增。
- 验证方式：清单内文件 `grep -n '| null'` 清零，或 QLT-4.2 的 AST 检查落地后不再报错。
- 责任与期限：由载荷迁移批次 B3（api）与 B4（web）执行，责任人为对应批次执行者；期限未排期，排期后在本节补充日期。
- 退出条件：下表 85 个字段全部改为 `?:` 后删除本节，并同步移除规范中的迁移期例外条款。

| 包     | 文件                                                                       | 接口 | 字段 |
| ------ | -------------------------------------------------------------------------- | ---- | ---- |
| api    | `apps/api/src/modules/agentic/application/ticket-view.service.ts`          | 6    | 18   |
| api    | `apps/api/src/modules/iam/application/navigation.service.ts`               | 1    | 7    |
| api    | `apps/api/src/modules/model-providers/domain/catalog.port.ts`              | 2    | 7    |
| api    | `apps/api/src/modules/model-providers/domain/model-usage.repository.ts`    | 2    | 5    |
| api    | `apps/api/src/modules/model-providers/domain/provider-model.repository.ts` | 2    | 5    |
| api    | `apps/api/src/modules/model-providers/domain/model-pricing.repository.ts`  | 1    | 3    |
| api    | `apps/api/src/modules/model-providers/domain/model-provider.repository.ts` | 1    | 3    |
| api    | `apps/api/src/modules/iam/domain/user.repository.ts`                       | 2    | 3    |
| api    | `apps/api/src/modules/connector/source-authorization.controller.ts`        | 1    | 2    |
| api    | `apps/api/src/modules/agentic/application/audit-record-view.service.ts`    | 1    | 1    |
| api    | `apps/api/src/modules/agentic/application/ticket.service.ts`               | 1    | 1    |
| api    | `apps/api/src/modules/connector/source.controller.ts`                      | 1    | 1    |
| api    | `apps/api/src/modules/iam/application/user.service.ts`                     | 1    | 1    |
| api    | `apps/api/src/modules/iam/domain/role.repository.ts`                       | 1    | 1    |
| web    | `apps/web/features/agentic/shared/types.ts`                                | 9    | 21   |
| web    | `apps/web/features/agentic/console/api/sources.ts`                         | 1    | 2    |
| web    | `apps/web/features/agentic/console/components/run-trace-panel.tsx`         | 1    | 1    |
| shared | `packages/shared/src/session.ts`                                           | 1    | 3    |
| 合计   | 18 个文件                                                                  | 35   | 85   |

## 回滚

文档与条款按提交整体 revert，并同步恢复 ADR-0004 状态行为“已接受”；无数据迁移与运行时变更。
