# ADR-0005 阶段 0 → 1：脚手架落地

> 状态：已接受 · 日期：2026-10-31 · 级别：L3

## 决定

落地 monorepo 脚手架。根工程：pnpm workspace + turbo 2.11.10 + Biome 2.6.4（全仓唯一 lint/format，含 Markdown）+ Vitest。`packages/shared`：错误码 union、Problem Details schema、分页形态。`apps/api`：Nest 12 骨架——`/api/v1` 前缀、RFC 9457 全局过滤器、zod 校验管道、`healthz`/`readyz`、Swagger 契约源、Prisma 7.10 driver-adapter（`@prisma/adapter-pg`）接入。`apps/web`：Next 16 骨架——TanStack Query、`@hey-api/openapi-ts` 0.99 契约生成管线、next domain lint。TypeScript 锁 `^5`；docker-compose 提供 PG(pgvector)/Redis。

## 被否决的选项

TypeScript 7.0.2（latest，生态兼容未验证）；独立 `@hey-api/client-fetch` 运行时包（0.73 起内置弃用）；pnpm `onlyBuiltDependencies` 旧字段（pnpm 12 改用 `allowBuilds` map，`@scarf/scarf` 遥测显式禁止）。

## 后果

命令注册表大部分转「可用」；本环境无 docker——compose、`prisma migrate`、`readyz` 的 DB 通过路径未实测（503 路径已实测）；`docs/` 首次经 Biome 格式化（空白级改动）；编译期实测修正的认知：Prisma 7 schema 不再承载 url（移 `prisma.config.ts`）、nest build 需 `rootDir=src`、Biome 2.6 配置改 `preset`/`domains` 对象化；**Biome `useImportType` 与 Nest DI 冲突**（把构造器参数导入改写为 `import type` → `design:paramtypes` 退化为 `Function` → 启动失败），`apps/api` 作用域关闭该规则并要求值导入；api tsconfig 采用 `nodenext`（值导入下 DI 元数据正常，node10 弃用告警随之消除）。
