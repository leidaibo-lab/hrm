# 前端结构规范（apps/web）

> 层：规范 · 时态：约束未来 · 失效：前端选型或分层变更时

## 目的

承载前端**结构与数据流**：分层、RSC、切片、组件划分、请求路径。视觉令牌、壳层与表格交互见 `web-ui.md`，表单见 `forms.md`。

## 何时读取

- 新增或修改 `apps/web` 下页面、组件、数据请求时。
- 评审前端 diff 时。

## 适用范围与不适用

- 适用：`apps/web` 全部源码。
- 不适用：`components/ui/`、`components/ai-elements/`（vendor 产物，升级时以原样覆盖为准）内部。

## 前端分层

1. `app/` 必须只做路由与布局；业务必须进 `features/` 垂直切片，每切片唯一导出面 `index.ts`。 `WEB-4.1`
2. RSC-first：页面默认 Server Component，`'use client'` 必须下沉到叶子组件。
3. 鉴权决策必须只在 API 端；middleware 只做会话重定向；业务 API 禁止进 `app/api/`。
4. 业务请求必须用生成的 client + TanStack Query，禁止手写 fetch。 `WEB-4.2`
5. `NEXT_PUBLIC_` 变量仅限非敏感配置。
6. 前端路由首段与 api 模块域名一致（`agentic` / `model-gateway` / `iam`），后续段与 api 资源命名同源（复数 kebab-case）；管理页不设 `/admin` 前缀，由权限点控制；导航项 `permission` 必须引用 `packages/shared` 权限点目录常量，禁止字面量。验证：`navigation-routes.spec.ts` 覆盖导航↔路由一致，api 命名同源与字面量靠人工 review。 `WEB-4.3`

## 组件划分

1. 单文件单组件：一个文件只承载一个顶层组件，同一文件导出第二个顶层组件禁止；私有子组件可同文件共存（不导出）。验证：`grep` 每文件导出组件数 ≤ 1。
2. 组件文件 ≤ 400 行，超过必须拆分；按真实文本行计数，禁止压缩代码规避。验证：`pnpm check:rules`。 `WEB-5.1`
3. 大组件目录化：拆分形态必须是目录而非散落兄弟文件——

   ```
   <big-thing>/
   ├── index.tsx        # 对外唯一出口，只做组合与布局
   ├── <part-a>.tsx     # 单一职责子组件（受规则 2 约束，可递归目录化）
   ├── <part-b>.tsx
   └── hooks.ts         # 目录内私有状态逻辑；逻辑多时升级为 hooks/ 目录
   ```

   对外只经 `index.tsx` 导出一个组件；子组件被外部需要时才上提。验证：目录抽查。
4. 状态归属按职责域判定，不按数量：必须下沉 hook——同一状态逻辑被第二个组件使用，或服务端状态进入本地 state；应该下沉 hook——一组状态与处理函数可独立命名（`useXxxState`）且与 JSX 结构无关（判定动作：这块状态搬走后组件 JSX 一行不改）；不限制同一职责域内的状态数量。验证：人工 review。

## 样式（代码层）

视觉令牌、层级、壳层与交互规则见 `web-ui.md`，本节只管代码写法：

1. className 单行超过 100 列（与 Biome `lineWidth` 一致），或 class 数 ≥ 8，必须改写为 `cn()` 多参形式：按 布局 → 间距 → 视觉 → 状态与条件类 分组，每组一个参数、独占一行。 `WEB-6.1`
2. 条件类必须经 `cn()` 参数表达，禁止在模板字符串内拼接条件类。
3. 豁免：`components/ui/`、`components/ai-elements/`。
4. 验证：`pnpm check:rules`（只机检长行，class 计数靠人工 review）。

## JSX 表达式

1. 条件渲染必须用 `cond && <Node />`，禁止 `cond ? <Node /> : null`。`&&` 左侧必须保证布尔语义——非布尔假值（数字 `0`、空串）会被 React 渲染成文本，必须显式转换（`!!x`、比较表达式）。 `WEB-7.1`

验证：`pnpm check:rules`（只匹配 JSX 条件渲染 `cond ? <Node /> : null` 形态；prop 赋值里的 `x ? y : null` 不在规则内）；布尔语义靠人工 review。

## 数据流转（唯一路径）

```
读：组件/页面 → 切片 hooks（TanStack Query + 生成的 client）→ /api/v1
    → controller（guard、进出校验）→ service（事务、资源级权限、DTO 映射）
    → infra 适配器 → Prisma / 外部
表格：页面 → TableView（配置 + query）→ 通用 createTableQuery → 生成的 client → /api/v1
    （TanStack Query 由 TableView 内部运行，键为 ['table-view', 表格 id, identityKey, scopeKey, params]）
写：同路径反向；回程必须经出站 zod schema parse 白名单后才出 controller
```

1. 请求只能由切片查询适配器发起，组件禁止直接调用生成的 client 函数；TableView 的 `query` 必须由通用 `createTableQuery({ request })` 创建，可直接内联传入。适配器统一处理 signal、错误和 `items → rows`；资源差异通过后端契约及 `scope` 声明。TableView 内聚查询状态和 TanStack Query，业务不得复制搜索、筛选、排序或分页 state。验证：grep `features/` 组件文件对生成 client 的 import，命中需人工 review。 `WEB-8.1`
2. queryKey 必须按域、资源、列表/详情、ID/参数分层并集中 api/keys.ts（表格托管键 `['table-view', 表格 id, identityKey, scopeKey, params]` 除外，由 TableView 内聚）；所有影响结果的参数入 key；queryFn 透传取消信号。mutation 必须登记关联失效范围（托管表格按 `['table-view', 表格 id]` 前缀失效），验证：行为测试 + review。
3. 服务端状态只进 TanStack Query；RHF 管独立表单草稿。身份变化必须取消旧请求、清理业务缓存；错误保留 code/status/traceId/errors，禁止退化为纯文案。验证：行为测试 + review。
4. TableView 查询状态使用 `sessionStorage`，列顺序、宽度、隐藏和冻结使用 `localStorage`；两者按用户、表格和数据范围隔离。存储恢复完成前不得按默认值发起首次请求；存储不可用时退回内存。 `WEB-8.2`
5. `features/<slice>/` 内部固定子结构：`api/`（hooks 与 queryKey）、`components/`、`hooks/`；对外唯一出口 `index.ts`。无服务端请求的纯组合切片可缺 `api/` 与 `hooks/`（如 workspace 壳层）。验证：目录抽查。
6. 只有真实跨端共享的纯规则进入 `packages/shared`；Web 内部复用留在 Web。shared 禁止依赖 React、Nest、Prisma、具体应用或服务 I/O。验证：依赖检查 + 人工 review。

## 依赖与技术接缝

1. components 只承载通用展示与交互，禁止依赖 feature 或业务 SDK；lib 技术工具禁止依赖 feature；workspace feature 经其他 feature 的 index.ts 组合业务壳；其他 feature 禁止反向依赖 workspace 或形成循环。 `WEB-9.1`
2. 跨 feature 只能经 index.ts；内部用相对导入，禁止经自身公开出口形成环。 `WEB-9.2`
3. lib/session.ts 为服务端会话接缝，lib/health.ts 为探针接缝；只允许这两个位置手写对应 fetch。api-client.setup.ts 仅配置 SDK；生成目录和 vendor 按精确路径豁免。 `WEB-9.3`

## 验证方式

- 组件行数 / className 长行 / `: null`：`pnpm check:rules`。
- web 测试（放置见 `testing.md`）+ typecheck（命令见 `../reference/verification.md`「命令注册表」）。
