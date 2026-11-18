# 验证：命令注册表与证据要求

> 层：描述 · 时态：描述现在 · 失效：命令或门禁状态变化时（每次落地即更新）

## 提交门禁

唯一命令与门禁登记处。规范正文只在所属文档定义，未实施、未执行、跳过不得写通过。
- commit-msg：commitlint；pre-commit：lint-staged → 暂存快照快速检查 → check:docs → check:rules → check:protected → typecheck → api test。
- pre-push：pnpm lint + pnpm test；任一失败拒绝对应提交或推送。
- 保护检查、hook、横切测试、架构测试、测试配置、CI 和核心工具配置；确认治理后用 `pnpm exec tsx scripts/checks/protected.ts --update --decision 0037` 更新基线，禁止静默自动更新。
- 远端：`.gitlab-ci.yml` 仅执行文档/架构/保护、lint、Prisma 客户端生成、离线 OpenAPI/SDK 生成、源码类型检查和无服务单测；不执行构建、迁移、DB 集成或启动 API/Redis；远端执行未核验。管理员必须核验受保护 main、禁止直接推送、要求成功流水线，以及规范/检查变更的有效审查；本地无法证明服务器设置已生效。

## 命令注册表

| 命令                                                                                                                                    | 状态   | 用途                                                  | 前置条件                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install`                                                                                                                          | 可用   | 安装依赖（`prepare` 自动启用 husky）                  | pnpm 12.9+                                                                           |
| `pnpm dev:api` / `pnpm dev:web`                                                                                                         | 可用   | 单应用开发模式（3011 / 3010）                         | 据 `apps/api/.env.example` 创建本地配置                                              |
| `pnpm dev`                                                                                                                              | 可用   | 全仓开发模式                                          | 据 `apps/api/.env.example` 创建本地配置；数据库经 docker compose；自动先跑 generate  |
| `pnpm lint`                                                                                                                             | 可用   | 全仓 lint + 格式检查（Biome）                         | 根级 `biome.json`                                                                    |
| `pnpm format`                                                                                                                           | 可用   | 全仓格式化 + 安全修复（只本地用）                     | 等于 `biome check --write .`                                                         |
| `pnpm typecheck`                                                                                                                        | 可用   | 全仓类型检查                                          | turbo 依赖图，先 Prisma generate + 构建 `@cip/shared`                                |
| `pnpm test`                                                                                                                             | 可用   | 单元测试（shared / api / web 三包）                   | Vitest                                                                               |
| `pnpm build`                                                                                                                            | 可用   | 全仓构建                                              | turbo 依赖图                                                                         |
| `pnpm generate`                                                                                                                         | 可用   | 全仓生成（当前仅 Prisma Client）                      | `DATABASE_URL` 占位值即可                                                            |
| `pnpm check:docs`                                                                                                                       | 可用   | 文档篇数 / 三元组 / 引用 / 命令 / 版本一致性 / PRD    | 无                                                                                   |
| `pnpm check:rules`                                                                                                                      | 可用   | 规则 ID 双向 + 前端与命名机检                         | 无                                                                                   |
| `pnpm check:protected`                                                                                                                  | 可用   | 检查设施哈希比对                                      | 基线 `protected-files.json`                                                          |
| `pnpm audit:drift`                                                                                                                      | 可用   | 漂移审计（组合文档、规则、保护；ADR/spec 归文档检查） | 无                                                                                   |
| `pnpm --filter @cip/web codegen`                                                                                                        | 可用   | 生成前端 api client                                   | `apps/api` 运行中（OpenAPI 由 Swagger 提供）                                         |
| `pnpm --filter @cip/api exec prisma migrate dev`                                                                                        | 可用   | 本地迁移                                              | docker compose postgres 就绪                                                         |
| `pnpm --filter @cip/api exec prisma migrate deploy`                                                                                     | 可用   | 应用迁移（`0001_init` 已应用，2026-11-01 端到端验证） | postgres 就绪                                                                        |
| `pnpm --filter @cip/api exec prisma db seed`                                                                                            | 可用   | 初始数据（super-admin + 管理员，需 `SEED_ADMIN_*`）   | migrate 已应用                                                                       |
| `docker compose up -d`                                                                                                                  | 可用   | 启动本地 postgres / redis                             | docker 可用；端口冲突用不入 git 的 override                                          |
| `git status --short` / `git diff --check`                                                                                               | 可用   | 工作区事实 / 空白错误                                 | 无                                                                                   |
| `pnpm check:changed --quick` / `pnpm check:changed --watch` / `pnpm check:changed --plan`                                               | 可用   | 工作区快速检查 / 保存监听 / 只输出计划；计划不算通过  | Git 与已安装依赖                                                                     |
| `pnpm check:changed`                                                                                                                    | 可用   | 批次验证：静态、类型、无服务测试、契约比较            | 已安装依赖；无数据库服务                                                             |
| `pnpm check:changed --mode staged --quick`                                                                                              | 可用   | 隔离暂存快照；不替代原门禁                            | Git index 与已安装依赖                                                               |
| `pnpm check:changed --mode ci`                                                                                                          | 可用   | CI 变更检查                                           | 合并请求基准或非零 CI_COMMIT_BEFORE_SHA；可用 --base 显式指定                        |
| `pnpm --filter @cip/api exec prisma validate`                                                                                           | 可用   | schema 语法和关系，不证明迁移已应用                   | 无数据库服务                                                                         |
| `TEST_DATABASE_URL=... pnpm --filter @cip/api test`                                                                                     | 可用   | 隔离数据库测试，未配置则 skipped                      | 专用测试库，禁止业务库                                                               |
| `OPENAPI_INPUT=http://localhost:3012/api/v1/docs-json pnpm --filter @cip/web codegen`                                                   | 可用   | 指定本次实际 API 生成 client                          | 对应 API 可用                                                                        |
| `pnpm --filter @cip/api exec prisma migrate diff --from-schema <before> --to-schema prisma/schema.prisma --script --output <migration>` | 可用   | 结构差异                                              | before 必须为真实变更前 schema                                                       |
| `pnpm exec tsc -p tsconfig.json`                                                                                                        | 可用   | 工程脚本类型，不产出 JS                               | 无服务                                                                               |
| `pnpm --filter @cip/api export:openapi`                                                                                                 | 可用   | 离线导出 controller 元数据                            | 无业务服务初始化                                                                     |
| `pnpm --filter @cip/api typecheck:ci` / `pnpm --filter @cip/web typecheck:ci`                                                           | 可用   | API/Web 类型，直接解析 shared 源码                    | 不触发 build                                                                         |
| `pnpm --filter @cip/api test:unit`                                                                                                      | 可用   | 单元与架构，不收集持久化集成用例                      | 无服务                                                                               |
| `pnpm exec tsx scripts/ops/retention-drill.ts preflight\|full DELETE_EXPIRED`                                                           | 需环境 | 保留归档演练：预检/apply/对账                         | `AGENTIC_BASE_URL`、`INTERNAL_API_TOKEN`、服务端 `AGENTIC_RETENTION_APPLY`、运营授权 |
| `scripts/ops/pg-backup.sh` / `pg-restore.sh` / `pnpm --filter @cip/api exec tsx scripts/ops/lease-check.ts`                             | 需环境 | 备份、恢复与多副本租约演练                            | docker postgres、隔离库、Redis                                                       |

CI 先离线导出，再用 OPENAPI_INPUT=../api/node_modules/.tmp/openapi.json 执行 Web codegen；不得使用 pnpm typecheck/test 的 Turbo 构建依赖作为 CI 替代入口。

## 验证矩阵

| 改动                                                                                                                                                                                                              | 最小集合                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 纯文档                                                                                                                                                                                                            | check:docs + check:rules                                 |
| 包内代码                                                                                                                                                                                                          | 相关单测 + typecheck + lint                              |
| API 契约                                                                                                                                                                                                          | api 全量测试 + typecheck + codegen + Web 消费验证        |
| Web 组件                                                                                                                                                                                                          | check:rules + Web 测试 + typecheck；交互人工或浏览器审查 |
| 跨包类型                                                                                                                                                                                                          | 所有消费方测试 + 全仓 typecheck，契约变化另 codegen      |
| 数据原子性/并发                                                                                                                                                                                                   | 隔离 DB 集成测试 + 迁移验证                              |
| 构建/依赖                                                                                                                                                                                                         | 全仓 build + 干净安装                                    |
| 规范/检查                                                                                                                                                                                                         | audit:drift + 合法/违规样例 + 相关全量测试               |
| 结果：node_modules/.tmp/quality/changed-<mode>.json；源码/基准变化使结果失效。passed 只代表本次自动项；人工项、快速模式未执行项、DB/发布证据单列；CI 缺少有效基准必须失败。暂存快照复用安装依赖，未证明干净安装。 |

## 规则 → 检查映射

覆盖为完整、部分或人工；部分项列剩余审查。security.md、runtime.md 按篇人工 review 与场景测试验收，未执行不得算通过。规范正文只在唯一出处维护，禁止凭落点文件存在声称执行。
| 规则 ID | 唯一出处                         | 覆盖                                                | enforcement | 落点                                                                     |
| ------- | -------------------------------- | --------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| ARC-4.1 | conventions/architecture.md      | 完整                                                | gitignore   | .gitignore + `pnpm check:docs`（git ls-files）                           |
| ARC-4.2 | conventions/architecture.md      | 完整                                                | spec        | architecture.spec.ts                                                     |
| ARC-5.1 | conventions/architecture.md      | 完整                                                | spec        | architecture.spec.ts                                                     |
| ARC-5.2 | conventions/architecture.md      | 完整                                                | spec        | architecture.spec.ts                                                     |
| ARC-5.3 | conventions/architecture.md      | 完整                                                | spec        | architecture.spec.ts                                                     |
| ARC-5.4 | conventions/architecture.md      | 部分；其余 review                                   | spec        | architecture.spec.ts + source-graph.ts（静态 Module；动态装配人工）      |
| ARC-5.5 | conventions/architecture.md      | 完整                                                | spec        | architecture.spec.ts                                                     |
| ARC-5.6 | conventions/architecture.md      | 完整                                                | spec        | architecture.spec.ts                                                     |
| ARC-7.1 | conventions/architecture.md      | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| CON-4.1 | conventions/contracts.md         | 人工                                                | manual      | review（响应契约 spec 待落地）                                           |
| CON-4.2 | conventions/contracts.md         | 完整                                                | spec        | problem-details.filter.spec.ts                                           |
| CON-4.3 | conventions/contracts.md         | 人工                                                | manual      | review                                                                   |
| CON-4.4 | conventions/contracts.md         | 人工                                                | manual      | review（缺省键与出站 null 映射；离线导出 diff）                          |
| CON-5.1 | conventions/contracts.md         | 部分；其余 review                                   | manual      | review（routes.spec.ts 部分覆盖：kebab / 嵌套）                          |
| CON-5.2 | conventions/contracts.md         | 完整                                                | spec        | routes.spec.ts                                                           |
| CON-5.3 | conventions/contracts.md         | 部分；其余 review                                   | manual      | review（routes.spec.ts 部分覆盖：tags / operation）                      |
| CON-6.1 | conventions/contracts.md         | 人工                                                | manual      | review                                                                   |
| PER-4.1 | conventions/database.md          | 人工                                                | manual      | review（prisma validate 仅兜底）                                         |
| PER-4.2 | conventions/persistence.md       | 人工                                                | manual      | review（迁移 diff）                                                      |
| PER-5.1 | conventions/persistence.md       | 人工                                                | manual      | review（schema 变更 diff）                                               |
| AUT-5.1 | conventions/authorization.md     | 完整                                                | spec        | sync.service.spec.ts                                                     |
| AUT-4.1 | conventions/authorization.md     | 完整                                                | spec        | endpoint-audit.spec.ts                                                   |
| AUT-6.1 | conventions/authorization.md     | 完整                                                | spec        | endpoint-audit.spec.ts                                                   |
| AUT-6.2 | conventions/authorization.md     | 完整                                                | spec        | endpoint-audit.spec.ts                                                   |
| AUT-7.1 | conventions/authorization.md     | 人工                                                | manual      | review（api 侧由 endpoint-audit.spec.ts 拦截）                           |
| AUT-9.1 | conventions/authorization.md     | 完整                                                | spec        | user.service.spec.ts                                                     |
| NAM-4.1 | conventions/naming.md            | 部分（含 runtime 两层封闭表正/负用例）；其余 review | spec        | architecture.spec.ts                                                     |
| NAM-4.2 | conventions/naming.md            | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| NAM-4.3 | conventions/naming.md            | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| NAM-5.1 | conventions/naming.md            | 人工                                                | manual      | review（机检待落地）                                                     |
| NAM-5.2 | conventions/naming.md            | 完整（AST 扫描 API/shared 声明标识符）              | script      | scripts/checks/rules.ts                                                  |
| WEB-4.1 | conventions/frontend.md          | 部分；其余 review                                   | manual      | review                                                                   |
| WEB-4.2 | conventions/frontend.md          | 部分；其余 review                                   | spec        | apps/web/lib/**tests**/architecture.spec.ts（静态调用；请求语义 review） |
| WEB-4.3 | conventions/frontend.md          | 部分；其余 review                                   | manual      | review（navigation-routes.spec.ts 仅导航↔路由）                          |
| WEB-5.1 | conventions/frontend.md          | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| WEB-6.1 | conventions/frontend.md          | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| WEB-7.1 | conventions/frontend.md          | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| WEB-8.1 | conventions/frontend.md          | 部分；其余 review                                   | spec        | apps/web/lib/**tests**/architecture.spec.ts（静态调用；请求语义 review） |
| WEB-8.2 | conventions/frontend.md          | 人工                                                | manual      | review：PRD 验收存储恢复、身份/范围隔离与存储不可用回退                  |
| UI-5.1  | conventions/web-ui.md            | 人工                                                | manual      | review                                                                   |
| UI-5.2  | conventions/web-ui.md            | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| UI-6.1  | conventions/web-ui.md            | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| UI-6.2  | conventions/web-ui.md            | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| UI-6.3  | conventions/web-ui.md            | 人工                                                | manual      | review（check:rules 输出候选）                                           |
| UI-6.4  | conventions/web-ui.md            | 人工                                                | manual      | review                                                                   |
| UI-6.5  | conventions/web-ui.md            | 人工                                                | manual      | review                                                                   |
| UI-6.6  | conventions/web-ui.md            | 人工                                                | manual      | review                                                                   |
| UIC-7.1 | conventions/web-ui-components.md | 人工                                                | manual      | review                                                                   |
| UIC-7.2 | conventions/web-ui-components.md | 人工                                                | manual      | review                                                                   |
| UIC-7.3 | conventions/web-ui-components.md | 人工                                                | manual      | review                                                                   |
| UIC-7.4 | conventions/web-ui-components.md | 人工                                                | manual      | review                                                                   |
| UIC-7.5 | conventions/web-ui-components.md | 人工                                                | manual      | review                                                                   |
| UIC-7.6 | conventions/web-ui-components.md | 人工                                                | manual      | review                                                                   |
| UIC-7.7 | conventions/web-ui-components.md | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| FRM-5.1 | conventions/forms.md             | 部分；其余 review                                   | script      | scripts/checks/rules.ts                                                  |
| FRM-5.2 | conventions/forms.md             | 人工                                                | manual      | review（check:rules 输出候选）                                           |
| FRM-5.3 | conventions/forms.md             | 人工                                                | manual      | review                                                                   |
| FRM-5.4 | conventions/forms.md             | 完整                                                | script      | scripts/checks/rules.ts                                                  |
| TST-4.1 | conventions/testing.md           | 人工                                                | manual      | review                                                                   |
| TST-6.1 | conventions/testing.md           | 人工                                                | manual      | review                                                                   |
| CMT-4.1 | conventions/code-comments.md     | 部分；其余 review                                   | spec        | code-comments.spec.ts                                                    |
| CMT-4.2 | conventions/code-comments.md     | 完整                                                | spec        | code-comments.spec.ts                                                    |
| CMT-4.3 | conventions/code-comments.md     | 完整                                                | spec        | code-comments.spec.ts                                                    |
| CMT-4.4 | conventions/code-comments.md     | 部分；修改源码 AST，其余 review                     | script      | scripts/checks/code-quality.ts + code-comments.spec.ts                   |
| DOC-3.1 | conventions/documentation.md     | 完整                                                | spec        | docs-governance.spec.ts + scripts/checks/docs.ts                         |
| DOC-3.2 | conventions/documentation.md     | 完整                                                | script      | scripts/checks/docs.ts                                                   |
| DOC-3.3 | conventions/documentation.md     | 完整                                                | script      | scripts/checks/docs.ts                                                   |
| BND-2.1 | process/boundaries.md            | 完整                                                | script      | pnpm check:docs                                                          |
| BND-2.2 | process/boundaries.md            | 完整                                                | script      | pnpm check:protected                                                     |
| NAM-6.1 | conventions/naming.md            | 部分；其余 review                                   | script      | scripts/checks/rules.ts（路径）；导出符号 review                         |
| WEB-9.1 | conventions/frontend.md          | 完整                                                | spec        | apps/web/lib/**tests**/architecture.spec.ts                              |
| WEB-9.2 | conventions/frontend.md          | 完整                                                | spec        | apps/web/lib/**tests**/architecture.spec.ts                              |
| WEB-9.3 | conventions/frontend.md          | 完整                                                | spec        | apps/web/lib/**tests**/architecture.spec.ts                              |
| NAM-7.1 | conventions/naming.md            | 完整                                                | script      | scripts/checks/rules.ts + tsc -p tsconfig.json                           |
| CMT-4.5 | conventions/code-comments.md     | 部分；修改公共类型字段覆盖，语义 review             | script      | scripts/checks/code-quality.ts                                           |
| QLT-4.1 | conventions/code-quality.md      | 部分；非空断言 AST，其余 review                     | script      | scripts/checks/code-quality.ts                                           |
| QLT-5.1 | conventions/code-quality.md      | 完整；修改源码                                      | script      | scripts/checks/code-quality.ts                                           |
| QLT-6.1 | conventions/code-quality.md      | 部分；空 catch AST，其余 review                     | script      | scripts/checks/code-quality.ts                                           |
| QLT-4.2 | conventions/code-quality.md      | 人工；载荷接口 AST 检查待落地                       | manual      | review（载荷 null 字段与 falsey 判空）                                   |
| DB-4.1  | conventions/database.md          | 部分；修改模型结构，其余 review                     | script      | scripts/checks/database.ts                                               |
| DB-4.2  | conventions/database.md          | 部分；声明/域登记/前缀一致，产品前缀 review         | script      | scripts/checks/database.ts + scripts/checks/rules.ts                     |
| DB-5.1  | conventions/database.md          | 部分；删除声明，策略 review                         | script      | scripts/checks/database.ts                                               |
| DB-6.1  | conventions/database.md          | 部分；相同普通索引，其余 review                     | script      | scripts/checks/database.ts                                               |
| CON-7.1 | conventions/contracts.md         | 部分；完整模式比较，复杂兼容性 review               | script      | scripts/checks/contracts.ts                                              |
| DB-7.1  | conventions/database.md          | 部分；离线 DDL 与迁移存在性，升级正确性另验         | script      | scripts/checks/changed.ts + scripts/checks/database.ts                   |

## 证据与失败处理

报告改动路径、真实命令/退出状态/关键输出、未验证项；机器与人工结果分开，跳过与失败不得写通过。失败先区分实现违规、环境缺口、检查缺陷和规范冲突；按 governance 修复，禁止扩大白名单或放宽断言；格式统一交给 Biome。
