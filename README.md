# HRM：CIP 工程基线

本仓库工程代码基于 CIP 模板 `09b1214a8cc7e577ae6b0f6aaafddc3ce9e83fe4`。原有产品、测试、发布文档和 HRM 历史工程文档保留；旧 Run 档案及目录已清理。历史实现和验证记录描述的是替换前版本。原招聘代码和数据库迁移已被模板替换，招聘功能尚未迁入新基线，不能将历史测试结果作为新代码的验收结果。模板自带的业务模块及配置仍需按 HRM 需求审查。

以下为模板原有说明：

# cip-platform

协同智能平台（Collaborative Intelligence Platform）——组织内的工作台与智能能力基座：统一认证与权限、平台后台配置、业务域按模块拓展。

## 技术栈

| 层          | 选型                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| 仓库        | pnpm 12 + turborepo monorepo                                                 |
| api（3011） | NestJS 12 · Prisma 7（PostgreSQL + pgvector）· Redis（会话）· zod 4          |
| web（3010） | Next.js 16（App Router）· React 19 · Tailwind 4 · shadcn/ui · TanStack Query |
| 共享        | `packages/shared`：权限点目录、导航目录、会话契约、错误码                    |
| 质量门禁    | Biome · Vitest · commit-msg（commitlint）· pre-commit（lint-staged）         |

## 快速开始

前置：Node.js ≥ 22.12、pnpm ≥ 12.9、Docker。

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # 按需修改（含初始管理员凭据）
docker compose up -d                          # PostgreSQL + Redis
pnpm --filter @cip/api exec prisma migrate deploy
pnpm --filter @cip/api exec prisma db seed    # 建内置 super-admin 角色与初始管理员
pnpm dev:api                                   # api → http://localhost:3011
pnpm dev:web                                   # web → http://localhost:3010
```

用 `.env` 里的 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` 登录 `http://localhost:3010`。注册默认开放（`AUTH_REGISTRATION_ENABLED`），新注册用户无任何权限，由管理员在「平台管理」分配角色；同一账号仅允许一处登录（新登录会踢下其他设备）。

## 常用命令

完整命令注册表与状态见 `docs/reference/verification.md`。

```bash
pnpm lint          # biome check（全仓门禁）
pnpm format        # biome check --write（全仓安全修复）
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest（shared / api / web）
pnpm build         # 全仓构建
pnpm --filter @cip/web codegen   # 由运行中的 api 生成前端 client
```

## 权限模型

权限点是页面与 API 共用的唯一授予单元（`resource:action`，如 `user:manage`），唯一事实源在 `packages/shared` 的权限点目录——各端只许引用常量，后台只配置「角色 × 权限点」。API 侧 deny by default，新增受保护端点必须声明权限点（端点审计测试强制）。细则见 `docs/conventions/authorization.md`。

## 文档

`docs/` 是面向 agent 的工程契约层（规范、事实、决策），人类读者从 `docs/index.md` 进入；agent 以根目录 `AGENTS.md` 为入口。
