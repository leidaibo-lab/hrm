# ADR-0009 权限模型与授权规范成篇

> 状态：已接受 · 日期：2026-11-01 · 级别：L3

## 决定

授权采用**静态路由 + 权限点驱动**：权限点是页面与 API 共用的唯一授予单元（`resource:action` 两段式），角色 × 权限点是后台唯一配置面；不建导航授权表，路由结构留在前端代码。权限点唯一事实源是 `packages/shared` 权限点目录（按资源域分文件），api 启动幂等 upsert 投影到 DB；各端只许引用目录常量。展示文案（导航 title/icon/sort、权限点 summary）走**单可空覆盖列**：`null` = 跟随代码目录默认，后台可编辑，同步永不触碰覆盖列；`/me` 下发合并（含权限与 `visible` 过滤）后的导航树。核心表：`User`、`Role`、`UserRole`、`PermissionPoint`、`RolePermissionPoint`、`NavigationNode`；词义绑定——`User` 专指平台登录账号，`Role` 专指平台级授权角色，其他域同义概念必须带资源限定词。API 侧 deny by default（未声明 `@RequirePermission` 且非 `@Public()` 的业务端点拒绝）；超管走内置 `super-admin` 角色（权限集合 `["*"]`，seed 初始化，禁后台删除）。按单组织设计，无租户模型（用户 2026-11-01 确认内部平台）。授权由 CASL 承载（`@casl/ability` 7.x，权限点 → `can(action, subject)`，前后端共享转换函数）；领域细则成篇于新文档 `docs/conventions/authorization.md`，现行文档预算 12 → 13 篇。审查靠三件套：全局端点权限审计测试、权限矩阵快照（PR diff 可见）、每受保护端点至少一条 403 用例。

## 被否决的选项

后端下发路由表 + 动态注册（RuoYi 模式）：App Router 文件系统路由无运行时注册机制，component 字符串映射脆弱且漏权面大。导航节点授权表（角色绑节点）：引入第二事实源，配置面错位——需求是配置权限而非运营菜单结构。后台自由录入权限点：契约性数据失去编译期校验与 review 关卡，且 App Router 下录入路由并不能免发版。`@casl/nestjs` 集成包：已从 npm 下架（2026-11-01 多渠道 404 核实），改用 NestJS 官方文档模式自持约 60 行集成代码。双列覆盖（`default*` + `display*`）：DB 默认列是同步时快照，发版后与代码目录漂移；代码目录才是默认值唯一来源。多租户模型：无 SaaS 计划，预留 `tenantId` 徒增全表成本。

## 后果

新增受权限保护页面成本 = 权限点目录登记 + 导航注册表项 + controller 装饰器，全程编译期校验；新模块接入权限收敛为「登记权限点 → 挂装饰器 → 补 403 用例」三步，基建全部复用。权限变更生效：菜单下次刷新、API 下一请求实时（前端感知滞后已接受，403 按 `code` 统一处理缓解）。CASL 第一阶段仅用权限点映射，conditions/fields 闲置，替换点收口在 shared `buildAbility()` 单函数。`SessionGuard` 权限集合实时查询 + LRU，失效须覆盖角色改权限、用户改角色、权限点废弃三类变更并全量单测——是实现难点。现行文档增至 13 篇；`governance.md`、`index.md`、`AGENTS.md` 计数与引用同步修订。
