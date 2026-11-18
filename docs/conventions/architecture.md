# 系统架构基础

> 层：规范 · 时态：约束未来 · 失效：出现新的分层、目录或依赖方向决定时

## 目的

承载**后端结构与依赖**的硬约束。契约见 `contracts.md`，数据层与基础设施见 `persistence.md`，命名见 `naming.md`，权限见 `authorization.md`。取舍理由见 `../decisions/0014-unified-ddd-layering.md`、`0018-api-directory-restructure.md`。

## 何时读取

- 新建 / 调整 `apps/api` 模块结构、目录、分层。
- 新增 `platform/` 能力或 `pipeline/` 机制。
- 评审跨层、跨模块 import 的 diff。

## 总体分层

1. 两个应用：`apps/api`（NestJS，唯一业务 API 提供方）、`apps/web`（Next.js，唯一前端）；跨端共享只进 `packages/shared`。
2. api 内部四层：接入层（controller / dto）→ 应用层（`application/*.service.ts`：用例编排、事务边界、资源级权限）→ 领域层（`domain/`：实体、repository 接口、领域事件）→ 模块基础设施（`infrastructure/`：端口实现 + mapper）；技术能力统一经 `platform/`，请求管线横切集中在 `pipeline/`，契约生成在 `openapi/`。
3. 业务请求必须只经 `/api/v1`；`apps/web` 不承担业务后端职责。
4. 一次请求的完整骨架（guard 链 → controller → application → domain → infrastructure → 响应）见 `../reference/architecture-overview.md`，本文只定义约束。

## 目录基线

```
apps/api/src/
├── main.ts、app.module.ts
├── config/      # 环境配置加载与校验
├── platform/    # 进程级技术能力：prisma、redis、queue、http、crypto
├── pipeline/    # 请求管线横切：audit、call-context、filters、guards、pipes、rate-limit
├── openapi/     # 启动期 OpenAPI 契约生成
├── testing/     # 测试辅助（build 排除）
└── modules/     # 业务模块（按域一模块，内部分层见「模块系统」）
apps/web/
├── app/         # 路由与布局
├── features/    # 业务垂直切片
├── components/  # 可复用 UI 与壳层
└── lib/         # 生成的 api client、工具
packages/shared/ # 类型、枚举、schema、纯函数
```

1. 必须不为未来建目录或包；新增顶层目录必须指明真实消费方。
2. codegen 产物禁止入 git：`apps/web/lib/api-client/`、`apps/api/src/platform/prisma/generated/`。验证：`.gitignore` 覆盖 + `pnpm check:docs`。 `ARC-4.1`
3. barrel 规则：`platform/<cap>/`、`pipeline/<机制>/`、`openapi/`、`testing/` 各设 `index.ts`；子域外导入必须经 barrel，子域内（含同子域 `__tests__/`）保持相对文件导入；`platform/prisma/generated/` 保持深路径且不入 barrel；顶层 `pipeline/` 不设 barrel。 `ARC-4.2`

## 依赖方向

1. `modules → platform / pipeline / openapi`；`pipeline → platform`；`platform → config`。禁止 `platform | pipeline → modules`。 `ARC-5.1`
2. `application/` 禁止 import `infrastructure/`、`dto/`、`pipeline/`、controller 与 module 根文件；其余依赖限定在 domain、application、platform、config 与 `@cip/shared`。外部能力经 `domain/` 端口（`*.repository.ts` / `*.port.ts`）+ 注入令牌取得，`<域>.module.ts` 作为组合根绑定实现（唯一同时 import 两层的文件）。 `ARC-5.2`
3. `domain/` 禁止 import `@nestjs/*`、`@prisma/client`、`@mastra/*`、`@ai-sdk/*`，禁止依赖 `application/`、`infrastructure/`、`dto/`、`pipeline/`、`platform/`、`config/` 和其他模块内部类型。 `ARC-5.3`
4. 模块间必须只经导出的 application Service 或领域事件通信；`<域>.module.ts` 作为组合根装配入口可被引用，其余内部文件禁止 import。公开服务必须在对方 Nest 模块 exports 中且经调用方模块 imports 可达；禁止循环依赖。跨域 ACL 允许在 `infrastructure/` 中调对方导出的 application Service，禁止直查对方存储或内部文件。 `ARC-5.4`
5. 接入层（`*.controller.ts` / `dto/`）禁止 import `infrastructure/` 与 `domain/`；controller 只依赖 application、dto、pipeline、openapi、platform、config 与 `@cip/shared`，dto 仅依赖本层 schema、`@cip/shared` 和 zod 校验库。 `ARC-5.5`
6. `infrastructure/` 只实现 domain 端口，允许依赖 domain、platform、pipeline、config 与 `@cip/shared`；禁止 import `dto/`、`*.controller.ts` 与本模块 `application/`。 `ARC-5.6`
7. 实体状态变更必须经实体方法；可变对象输入输出必须防御性复制；业务不变量、事务及并发正确性须行为测试与人工审查。
8. 类令牌注入必须值导入；接口依赖必须 type 导入并使用显式 `@Inject(TOKEN)`。应用层禁止识别 Prisma 错误码或实现供应商协议；根 `app.module.ts` 装配全局 guard 是明确入口例外。

## 模块系统（DDD 分层纪律）

```
modules/<domain>/
├── <域>.module.ts / <resource>.controller.ts / dto/   # 接入层
├── domain/          # 实体（类 + 行为）、repository 接口、领域事件
├── application/     # *.service.ts：用例编排、事务边界、资源级权限
└── infrastructure/  # 端口实现 + mapper
```

1. 模块入口必须 `<域>.module.ts`；仓储与能力端口统一在 `domain/`，禁止新增 `ports/` 或 `application/ports/`。模块路由前缀与模块域名一致，API 与 Web 首段同名（见 ADR-0080）。
2. 应用层保留 `*.service.ts` 单元（方法即用例、事务边界），禁止每操作拆 usecase 类；查询类用例可经 repository 直返读模型。
3. 重武器（每操作 usecase 类、CQRS 命令总线、saga、事件溯源）按 `../decisions/0014-unified-ddd-layering.md` 附录 B 判据引入；未命中判据禁止预建。
4. `health` 等无领域逻辑的运维端点豁免领域层，保持 controller-only（唯一例外）。
5. 单测就近同目录 `__tests__/`，文件名跟随被测对象；测试放置与 mock 纪律见 `testing.md`。

## 工具链

1. Biome 是唯一 lint 与格式化工具，配置在根 `biome.json`；禁止引入 ESLint/Prettier 并行配置。验证：`pnpm lint` + `pnpm check:rules`。 `ARC-7.1`
2. 提交门禁内容见 `../reference/verification.md`「提交门禁」；本文件不复制门禁命令。
3. GitLab CI 配置按 ADR-0024 只做无构建、无外部服务检查；服务端强制门禁必须经管理员核验；实际状态与机检清单见 `../reference/verification.md`「规则 → 检查映射」。

## 验证方式

- `apps/api/src/__tests__/architecture.spec.ts`：目录角色白名单、依赖方向、跨模块 import、barrel 位置。
- `pnpm --filter @cip/api test` + `pnpm typecheck`（命令见 `../reference/verification.md`）。
