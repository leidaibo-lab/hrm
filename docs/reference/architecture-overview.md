# 当前架构总览

> 层：描述 · 时态：描述现在 · 失效：运行时架构、目录结构或请求链路变化时

本文件解释**现在长什么样**：运行时、仓库地形、一次请求如何穿过各层、前端如何取数。规则在 `../conventions/`，命令在 `verification.md`，取舍理由在 `../decisions/`。

## 运行时架构

```
浏览器（会话 cookie）
  │ HTTPS
  ▼
apps/web   Next.js（开发端口 3010）—— 页面渲染与路由，不承担业务后端
  │ HTTP /api/v1
  ▼
apps/api   NestJS（端口 3011）—— 唯一业务 API；队列消费者与进程同生
  ├──▶ PostgreSQL 16 + pgvector（经 Prisma 适配器）
  ├──▶ Redis 7（会话 / 限流 / 队列）
  └──▶ 外部 HTTP 服务（经 http 适配器）
```

- api 统一前缀 `/api/v1`，OpenAPI 文档挂 `/api/v1/docs`，JSON 在 `/api/v1/docs-json`。
- 探针不挂前缀：`/healthz` 只探进程存活，`/readyz` 额外检查数据库与 Redis。
- 本地 PostgreSQL（5432）与 Redis（6379）由 docker compose 提供；端口冲突可用不入 git 的 override 调整。
- 生产部署目标待定：尚无 Dockerfile 与部署清单。

## 仓库地形

```
cip-platform/
├── apps/
│   ├── api/                 # NestJS：唯一业务 API
│   │   ├── prisma/          # schema、迁移与 seed
│   │   └── src/             # config / platform / pipeline / openapi / testing / modules
│   └── web/                 # Next.js：唯一前端
│       ├── app/             # 路由、布局与页面编排
│       ├── features/        # 业务垂直切片：组件、请求、导出面
│       ├── components/      # 可复用 UI 与壳层，不取数
│       └── lib/             # 会话接缝、环境配置、生成的 API client
└── packages/shared/         # 跨端共享：类型、枚举、schema、常量、纯函数
```

## 一次请求如何穿过 DDD 各层

```
 1. 生成或复用 traceId，回写响应头
 2. 来源校验 guard：非 GET 请求校验 Origin（防 CSRF）
 3. 认证 guard：解析会话 cookie，取出当前用户
 4. 授权 guard：按端点声明的权限点用 CASL ability 判定；公开端点跳过
 5. controller：参数级 zod 校验后转 DTO
 6. application：用例编排、事务边界、资源级权限
 7. domain：实体行为与 repository 接口
 8. infrastructure：端口实现，落 platform
 9. 响应：zod schema parse，兼做字段白名单剥离
10. 异常：全局 filter 转为 RFC 9457 的 problem+json
    旁路：审计 interceptor 落审计表，写失败不影响业务响应
```

| 环节           | 数据形态                                        | 谁负责转换                           |
| -------------- | ----------------------------------------------- | ------------------------------------ |
| HTTP 入参      | 原始字符串 / JSON                               | 接入层：zod schema 校验并收窄类型    |
| DTO / 命令参数 | 结构化值，如 `{ id, status }`                   | 接入层 → 应用层                      |
| 聚合对象       | 带行为的领域对象，只能经工厂重建                | 基础设施 mapper：持久化行 → 领域对象 |
| 读模型         | 拍平的视图数据（时间是 ISO 字符串、关联已拍平） | 基础设施 repository 的查询方法       |
| 响应 JSON      | 白名单字段                                      | 接入层：响应 schema `parse()`        |

## 前端：首屏与交互

- **首屏**：`app/(workspace)/layout.tsx`（服务端）经 `getSession()` 取会话；无会话 → `/login`，权限不足 → `/403`；会话、nav、permissions 注入客户端壳。业务数据不在服务端预取。
- **交互**：切片组件 → feature hook（TanStack Query）→ 生成的 SDK → `/api/v1` → 缓存；mutation 成功按 queryKey 前缀失效。
- **约定**：queryKey 工厂集中在切片 `api/`；页面不直接 import SDK；通用表格内部托管 TanStack Query，并通过通用适配器调用生成 client；错误由 hook 抛成保留 code/status/traceId 的 ApiError，组件层 toast / 错误边界呈现；请求响应类型只来自生成的 client，契约变更重跑 codegen。

### TableView 当前链路

- `apps/web/components/table-view` 承载 toolbar、筛选/排序编辑器、列设置 Drawer、悬浮选择、列拖拽/resize、行/批量动作、sticky/flow 布局和回调。
- `apps/web/lib/table-query.ts` 提供 createTableQuery，feature API 只再导出生成 SDK 请求。查询状态 sessionStorage，列偏好 localStorage，键按用户/表格/scope 隔离；数据与 meta 由同一 Query cache 承载。
- users、roles、ai/providers、ai/models、ai/usages 提供资源 POST query 端点；shared 提供字段定义/schema/plan，`apps/api/src/platform/table-query` 提供安全 where/order/page 组装；资源 repositories 处理关系投影和权限范围。
- 用量查询在 RepeatableRead 快照内读取分页、总数和 meta；金额使用 Decimal。成员、角色、供应商、模型和用量五个表格使用新契约，非表格模型能力选择仍保留独立 GET。
- 本地实施不等于已部署；产品规格及验收入口见 `../prd/table-view.md`。

## 数据与存储

| 存储                  | 定位                           | 访问方式                                   |
| --------------------- | ------------------------------ | ------------------------------------------ |
| PostgreSQL + pgvector | 业务数据与审计数据的唯一事实源 | 只经 Prisma 适配器；raw SQL 封装在适配器内 |
| Redis                 | 会话、限流计数、队列后端       | 只经注入的 redis / queue 适配器            |
| 对象存储（S3 兼容）   | 附件等二进制内容               | 规则已定，适配器未落地                     |

## 质量门禁现状

- 门禁内容（钩子、命令、检查设施保护清单）唯一来源：`verification.md`「提交门禁」；本文不复制。
- 机检清单（横切 spec + `pnpm check:docs` / `pnpm check:rules` / `pnpm audit:drift`）同样登记在 `verification.md`。
- GitLab CI 按 ADR-0024 不构建、不启动外部服务；服务器流水线与受保护分支尚未在本任务核验。

## 维护约定

只在**结构与链路**变化时更新本文：新增业务域不触发修改，规则细节进 `../conventions/`。本文与源码冲突时以源码为准，修文档并在提交信息说明。
