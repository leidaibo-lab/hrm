# 接口契约规范

> 层：规范 · 时态：约束未来 · 失效：契约形态或路由治理变更时

## 目的

承载**一次接口变更的全部约束**：契约生成、响应形态、错误码、路由与查询参数、跨端标识。实现分层见 `architecture.md`，数据映射见 `persistence.md`。

## 何时读取

- 新增 / 修改任何 API 端点、响应结构、错误码、路由或查询参数。
- 重跑前端 codegen、评审 OpenAPI diff 时。

## 契约管线

1. 契约由 Nest DTO/schema 与 Swagger 装饰器导出 OpenAPI：NestJS 经 `@nestjs/swagger` 生成 OpenAPI，前端以 `@hey-api/openapi-ts` 生成 client；**NestJS 是契约唯一事实源**。
2. `packages/shared` 只放非契约共享物（类型、枚举、schema、纯函数）；API 类型必须来自生成的 client，禁止手写。
3. 运行时校验统一 zod；前后端共享 schema 必须放 `packages/shared`。
4. codegen：命令与前置条件见 `../reference/verification.md`「命令注册表」；产物 `apps/web/lib/api-client/` 不入 git；DTO / 路由变更必须重跑并提交消费侧改动。
5. Swagger 端点（UI 与 `docs-json`）仅在非生产环境注册；生产的契约导出与 diff 一律走离线导出（`export:openapi`），不经 HTTP 暴露元数据。

## 响应契约

1. 成功响应必须返回裸载荷与正确 HTTP 状态码，禁止包裹 `{ code, data }` 信封。 `CON-4.1`
2. 失败响应必须遵循 RFC 9457，`Content-Type: application/problem+json`：标准成员 `type`（默认 `about:blank`）、`title`、`status`、`detail`、`instance`；扩展成员 `code`（字符串业务错误码，域前缀分节，如 `project.not_found`）、`traceId`；字段级校验失败用 `errors[]`。 `CON-4.2`
3. 机器判断只依赖 `code`；`title` / `detail` 文案不得作为判断依据。 `CON-4.3`
4. 载荷子约定：列表返回 `{ items, nextCursor }`（offset 分页可附 `total`）；无值字段省略键，不发送 `null`，仅当目标协议要求键存在时由出站适配层显式 `null`；时间一律 ISO 8601 UTC 字符串；ID 一律字符串；JSON 字段 camelCase。 `CON-4.4`

## 路由与查询（ADR-0019）

1. 资源名用复数 kebab-case（如 `/projects`）；子资源嵌套不超过 2 层；多顶级资源的业务域可用领域前缀段分组（首个 `ai`），领域前缀段不计嵌套层。 `CON-5.1`
2. 字段型状态变更用 `PUT /:id/<field>` + body 枚举；动作型变更用 `POST /:id/<verb>`（如 `POST /projects/:id/archive`）；禁止用 PATCH 改状态字段。整体资料更新（名称、描述等非状态字段集合）可用 `PATCH /:id`（部分更新语义）或 `PUT /:id`，同一资源域内必须一致。 `CON-5.2`
3. 简单资源列表可以使用 GET 查询参数；TableView 结构化查询必须使用资源自己的 `POST /<resource>/query` 只读端点，JSON body 统一包含 `page`、`pageSize`、`q`、`filters`、`sort` 及资源声明的 `scope`。POST 查询必须显式返回 200，不得使用默认 201。
4. TableView 查询操作符仅限 `eq`、`neq`、`contains`、`not_contains`、`before`、`not_before`；DTO 必须校验字段白名单和字段允许的操作符，未知字段、重复字段和非法组合返回 400。
5. TableView offset 响应使用 `{ items, total }`，可选 `meta`；游标响应使用 `{ items, nextCursor }`，同一端点不得混用分页形态。
6. TableView 排序按 `sort` 数组顺序执行，并追加稳定唯一 ID 排序；`items`、`total` 与 `meta` 使用相同权限范围和筛选条件。查询端点不得产生业务写入。
7. 协议端点（`/auth`、`/healthz`、`/readyz`）不适用资源复数规则，新增此类端点须在本节登记。
8. OpenAPI 必填：controller 带 `@ApiTags`，每条路由带 `@ApiOperation`（summary 非空），body 入参带 `@ApiBody`，路径参数必须显式 `@ApiParam`，以支持无构建元数据导出。 `CON-5.3`
9. 审计 action 统一 `<域>.<动作>`，域取权限点 resource 段（kebab）。
10. `/api/v1` 前缀不可变；破坏性变更升 v2；弃用端点标 `deprecated` 并带 `Deprecation` / `Sunset` 响应头。

## 跨端标识

跨端字符串标识（业务错误码、权限点等）必须以常量集中定义于 `packages/shared`（web 需按 `code` 映射 UI 状态，常量表是唯一来源），禁止散落字符串字面量；权限点 code 的 resource 段必须与 api 模块域名一致，细则见 `authorization.md`。 `CON-6.1`

## 兼容演进

1. 变更必须与目标基准的真实 OpenAPI 比较；移除端点/字段、增加必填、收紧输入或改变类型必须阻止自动通过。破坏性变更必须另经明确版本/迁移决定，不得用更新快照掩盖。 `CON-7.1`
2. 新增可选字段和端点可以兼容；枚举、组合 schema、响应保证及认证变化必须按输入/输出方向审查。比较器未覆盖的语义必须单列人工项，导出失败不得算兼容。

## 验证方式

- `apps/api/src/__tests__/routes.spec.ts`：路由 kebab、嵌套 ≤2、动作子路径 POST、扫描非空守卫、tags 与 operation 摘要；不查资源复数与 `@ApiQuery` / `@ApiBody`（CON-5.1 / CON-5.3 由 review 判定，routes.spec 仅部分覆盖）。
- `apps/api/src/pipeline/filters/__tests__/problem-details.filter.spec.ts`：RFC 9457 失败响应（CON-4.2）。
- `apps/api/src/__tests__/endpoint-audit.spec.ts`：端点权限声明与公开端点白名单。
- api 全量测试 + typecheck（命令见 `../reference/verification.md`「命令注册表」）。
- OpenAPI diff：契约变更前后人工比对 `/api/v1/docs-json`；自动 diff 门禁待落地（登记在 `../reference/verification.md` 状态栏）。
