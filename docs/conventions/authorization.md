# 授权与访问控制规范（权限域）

> 层：规范 · 时态：约束未来 · 失效：权限模型选型变更时（见 `../decisions/0009-permission-model.md`）

## 目的

承载权限域细则：权限点、目录同步、guard 使用、前端消费。基线（两级权限、契约管线、跨端标识单源、错误码）见 `architecture.md` 与 `contracts.md`，本文件不复制。

## 何时读取

- 新增或修改任何带权限的业务模块、controller、导航项时。
- 评审涉及 `@RequirePermission`、权限点目录、导航目录的 diff 时。

## 领域与模型

1. 权限点是唯一授予单元，code 为 `<domain>.<resource>:<action>`；domain 为 api 模块域名（`agentic` / `model` / `iam`），resource 为领域资源（kebab-case），action 只取 `read` / `create` / `update` / `delete` / `manage`，不再新增域动词（见 ADR-0081）。
2. `User` 专指平台登录账号，`Role` 专指平台级授权角色；跨域同义概念必须带资源限定词（如 `ProjectRole`），禁止复用裸名（词义绑定见 ADR-0009）。
3. 数据权限（行级可见范围）归应用服务（`application/` 下 `*.service.ts`）判定，禁止进 guard；Space 是数据可见性边界，业务资源表必须带 spaceId，查询谓词前置，越界统一按不存在处理。

## 权限点目录（唯一事实源）

1. 目录在 `packages/shared/src/permissions/`，按资源域一文件；新增权限点必须先登记目录，禁止在业务代码手写权限点字面量。 `AUT-4.1`
2. 目录条目含 `code` / `resource` / `action` / `summary`；summary 是人类可读说明，禁止空泛表述（如「项目权限」）。
3. 前端导航项 `permission` 与 api 装饰器参数必须引用目录常量。验证：`endpoint-audit.spec.ts` + `tsc` + 人工 grep 字面量。

## 同步与投影（代码为源、DB 为投影）

1. api 启动时把权限点目录与导航目录幂等 upsert 到 `PermissionPoint` / `NavigationNode`：新增建行（覆盖列 `null`）；已存在只校验结构镜像；代码中删除的标记 `deprecated`，禁止物理删除。验证：`sync.service.spec.ts`。 `AUT-5.1`
2. 覆盖列（`title` / `icon` / `sort` / `summary`）单列可空：`null` = 跟随代码目录默认值；同步禁止触碰覆盖列。
3. 结构镜像不一致（`path` / 层级 / `permissionCode` 与目录不符）必须在启动日志告警。

## guard 使用（api）

1. 全局 deny by default：业务端点必须 `@RequirePermission(...)` 或 `@Public()`，未声明的业务端点禁止出现。 `AUT-6.1`
2. `@Public()` 仅限 auth 端点与探针（`healthz` / `readyz`）。 `AUT-6.2`
3. 认证（SessionGuard）与授权（PoliciesGuard）分层注册；权限集合实时查询，缓存失效必须覆盖三类变更：角色改权限点、用户改角色、权限点废弃。
4. 资源级判定在应用服务，禁止复制 guard 的权限点逻辑。

## 前端消费（web）

1. 导航树由 `/me` 下发（api 已完成覆盖合并、`visible` 与权限过滤），web 直接渲染，禁止在前端重建过滤逻辑。
2. 组件级显隐用 `<Can>`（ability 由 shared `buildAbility` 构建）；菜单隐藏不是安全边界，真正拦截在 api guard。 `AUT-7.1`
3. 401/403 按 `@cip/shared` 错误码统一处理，禁止按响应文案判断。

## 新模块接入

实施顺序统一见 `../process/workflow.md`「带权限模块实施顺序」；本文件只维护权限规则，不复制执行步骤。

## 生效契约

1. 菜单 / 按钮：下次整页刷新生效，禁止做实时推送。
2. API 拦截：下一请求实时生效——SessionGuard 每请求经 `UserService.findSessionUser` 实时展开权限，**不设权限集合缓存**；撤销角色、挂起用户、废弃权限点均对下一请求立即生效（若未来引入缓存，必须补失效测试）。验证：`user.service.spec.ts`。 `AUT-9.1`
3. 会话为单设备互踢：同一账号仅保留一个有效会话，新登录即时作废旧会话，被踢设备下一请求 401。

## 验证方式

- `endpoint-audit.spec.ts`：端点权限声明、公开端点白名单、权限点字面量。
- `permission-matrix.snap` 快照：权限矩阵变更需显式更新。
- api 全量测试（命令见 `../reference/verification.md`「命令注册表」）。
- 权限变更即时生效、目录同步投影：`user.service.spec.ts` / `sync.service.spec.ts`（随 api 测试执行）。
- 菜单隐藏非安全边界：review（`endpoint-audit.spec.ts` 已覆盖 api 侧拦截）。
