# ADR-0018 api 顶层目录重构：platform 与 pipeline/openapi/testing

> 状态：已接受 · 日期：2026-11-06 · 级别：L3

## 决定

1. `apps/api/src/adapters/` 更名 `apps/api/src/platform/`：它是**进程级技术能力**（prisma/redis/queue/http/crypto），不是 DDD 的端口实现（后者在模块 `infrastructure/`）。
2. 拆分 `apps/api/src/common/`：
   - `pipeline/`：请求管线机制（audit / filters / guards / pipes / rate-limit）；
   - `openapi/`：启动期 OpenAPI 契约生成（原 `common/swagger`）；
   - `testing/`：测试辅助（原 `common/testing`，移出运行时树并加入 build exclude）。
3. 每个 `pipeline/<机制>/` 与 `platform/<能力>/` 必须带 `index.ts` barrel；顶层 `pipeline/` 不设 barrel。
4. 依赖方向：`modules → platform/pipeline/openapi`；`pipeline → platform`；`platform → config`；反向禁止。

## 被否决的选项

- 保留 `adapters/`：与 DDD 的 adapter（端口实现）语义冲突，且模块内已有 `infrastructure/`，新成员无法从目录判断该放哪。
- 保留 `common/` 只做内部调整：`common` 是垃圾桶高风险名，测试辅助混在运行时树会被编译进 `dist`。
- 改 `common → kernel/`：shared kernel 指跨限界上下文共享模型，与 HTTP 管线语义不符。
- 拆 `common` 时保留顶层 `pipeline/index.ts`：大 barrel 会引入循环依赖，导入统一写 `pipeline/<机制>`。

## 后果

- 约 69 条 import 改写；Prisma 生成路径、`turbo.json`、`.gitignore`、`prisma/seed.ts` 同步更新并重跑 `pnpm generate`。
- 顶层目录：`config/`、`platform/`、`pipeline/`、`openapi/`、`testing/`、`modules/`。
- 回滚：单次提交 revert 即可（无数据迁移、无契约变更）。
