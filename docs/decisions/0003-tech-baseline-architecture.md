# ADR-0003 技术选型基线与架构规范

> 状态：已接受 · 日期：2026-10-31 · 级别：L3

## 决定

采纳技术栈基线——NestJS + Next.js + pnpm/turborepo 单仓；PostgreSQL（pgvector）+ Redis；OpenAPI-first 契约 + 前端 codegen（`@nestjs/swagger` → `@hey-api/openapi-ts`）；zod 运行时校验；Biome 替代 ESLint + Prettier（CI 以 `tsc --noEmit` 兜类型）；Vitest 测试。平台功能域定为：飞书集成（OAuth 登录 / 通讯录同步 / 机器人消息 / 事件回调）、Agent 能力、平台基础（认证 / 用户组织 / 通知 / 审计）。新增 `docs/conventions/architecture.md`，该文档只承载**系统架构基础**（总体分层、目录基线、基础设施适配器、契约管线、横切机制、模块系统、工具链），具体业务模块按模块系统规则后续拓展，现行文档预算 9 → 10 篇。

## 被否决的选项

tRPC 契约（NestJS 侧不自然）；zod 单源生成 OpenAPI（三方转换器兼容未验证，列为演进方向）；保留 ESLint + Prettier（双工具双配置，类型感知优势可由 `tsc --noEmit` 兜底）；知识库与 collab（项目/任务/评论）功能域（用户明确平台不含）。

## 后果

现行文档增至 10 篇；类型感知 lint 覆盖弱于 typescript-eslint，依赖 CI 编译检查与测试兜底；飞书成为认证、组织、通知的主渠道，站内能力为辅；agent 框架层（AI SDK / 编排库）为待验证项，落地时登记 `verification.md`；域级细则（飞书事件回调同步路径只验签入队、组织以飞书为唯一来源、模型调用唯一出口 LLM Gateway、工具集中注册带权限校验、agent 执行全量落库）在对应业务模块建立时按治理生长规则落规范。
