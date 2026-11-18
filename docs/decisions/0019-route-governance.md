# ADR-0019 路由与契约文档治理

> 状态：已接受 · 日期：2026-11-06 · 级别：L3

## 决定

1. 资源段复数 kebab-case，子资源 ≤2 层，领域前缀段（`ai`）不计层。
2. 字段型状态用 `PUT /:id/<field>` + body 枚举；动作型变更用 `POST /:id/<verb>`；禁止用 PATCH 改状态字段。
3. 查询参数统一：排序 `sort=<field>&dir=asc|desc`、过滤 `filter.<字段>=值`、分页 `page/pageSize`（offset）或 `cursor`。
4. 审计 action 统一 `<域>.<动作>`，域 = 权限点 resource 段（kebab）。
5. OpenAPI 必填：controller 带 `@ApiTags`，每条路由带 `@ApiOperation`，每个入参带 `@ApiQuery`/`@ApiBody`。
6. 机器校验：`src/__tests__/routes.spec.ts` 断言命名、动作 POST、路由唯一、tags/operation 必填。
7. `/api/v1` 不可变；破坏性变更升 v2；弃用加 `deprecated` 与 `Deprecation`/`Sunset` 头。

## 被否决的选项

- 维持 `sort=+字段/-字段`：三个 controller 与 web 已用 `sort+dir`，改规则比改代码便宜且与规则「初值校准」定位一致。
- 立刻把 `enabled` 从 PATCH 拆出为子资源：属跨包契约变更，排在 P4，避免与本次结构重构混在同一提交。
- 不写路由测试：`usage` 漏声明 `filter.from/to`、`enabled` 风格漂移均属可机器发现的问题。

## 后果

- 当前 P1-P3 不改变路由与响应契约，OpenAPI 路由 diff 应为空；新增 tags/operation 摘要属文档增强。
- 存量偏差（`PATCH /ai/providers/:id` 携带 `enabled`、`usage` 的 `sort` 形态）在 P4 收敛，需重跑 web codegen。

## 实施备注（2026-11-06）

P4 同日完成：新增 `PUT /ai/providers/:id/enabled`、`PUT /ai/models/:id/enabled`，二者从原 update schema 移出；`usage` 排序改为 `sort` + `dir`；web client 已重新生成，供应商/模型启停与用量排序已切换新契约。OpenAPI 路径 26→28，api 测试 77 例保持全绿。
