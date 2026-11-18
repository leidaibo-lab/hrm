# 身份与访问（iam）总体设计

## 一、文档信息

| 项目     | 内容                                                                 |
| -------- | -------------------------------------------------------------------- |
| 文档编号 | PRD-IAM-DESIGN                                                       |
| 版本     | V3.0（2026-11-17）                                                   |
| 状态     | 草稿                                                                 |
| 作者     | 产品与工程共同确认                                                   |
| 关联决策 | ADR-0009（角色词义）、ADR-0047（行级可见性）、ADR-0077（单模块结构） |

### 版本记录

| 版本 | 日期       | 变更                                           | 原因     | 作者 |
| ---- | ---------- | ---------------------------------------------- | -------- | ---- |
| V3.0 | 2026-11-17 | 按限界上下文拆分；Space 边界、动作词与能力令牌 | 架构对齐 | lead |

## 二、总体架构与 Super-agent 运行模型

iam 是平台的支撑域，不参与任务调度，只回答三个问题：

1. 这个身份能不能做这个动作（动作权限）；
2. 这个身份能不能看这条数据（Space 可见性）；
3. 这段 Agent 执行凭什么做（能力令牌）。

链路：登录 → 会话（userId、权限点、空间列表）；请求 → 动作判定（CASL）→ 数据谓词（Space）→ 对象判定（AuthorizationService）；派工 → 能力令牌（空间、工单、工具、动作、有效期）。

分层：

| 层   | 内容                           | 失败语义   |
| ---- | ------------------------------ | ---------- |
| 动作 | 权限点 + CASL                  | 403        |
| 数据 | Space 成员关系 + 查询谓词      | 404        |
| 资源 | AuthorizationService（对象级） | 404        |
| 字段 | 视图脱敏                       | 字段不返回 |

## 三、领域模型

| 概念            | 职责                                 | 关键规则                              |
| --------------- | ------------------------------------ | ------------------------------------- |
| User            | 平台登录身份                         | 用户名唯一；状态可挂起                |
| Role            | 权限点集合                           | 角色 code 唯一；内置角色不可删        |
| PermissionPoint | 权限点目录（代码为源）               | 命名空间 + 动作词；删除标废弃不物理删 |
| RoleAssignment  | 角色授予（platform 或 space 作用域） | 同主体同角色同作用域唯一              |
| Space           | 数据可见性与工作归属边界             | key 唯一；有资源时不可删              |
| SpaceMember     | 用户与空间成员关系                   | (spaceId, userId) 唯一；移出即不可见  |
| CapabilityToken | 派工签发的执行令牌                   | 范围是任务子集；到期失效              |

不变量：动作与数据分离；空间成员决定可见性；权限点以代码目录为准；令牌不得放大父级范围。

## 四、端到端数据流

登录：验证身份 → 查询角色授予 → 展开权限点 → 建立会话。

请求：SessionGuard 取会话（实时）→ PoliciesGuard 动作判定 → 应用服务加载资源（带 Space 谓词）→ 404 或 AuthorizationService 对象判定 → 字段脱敏 → 返回。

派工：Engine 签发能力令牌（assignment、spaceId、ticketId、tools、actions、ttl）→ 工具调用校验令牌 → 再判定资源 → 返回或结构化拒绝。

越权语义：动作缺失 403；数据不可见 404；状态冲突 409；未登录 401。

## 五、技术方案

- 动作权限：CASL，每次请求按会话权限点重建 ability；权限点目录在共享包，代码为唯一事实源。
- 数据可见性：Space 成员关系生成查询谓词；仓储层统一注入；应用服务做对象级判定。
- 资源判定：AuthorizationService 对外唯一入口；当前实现为 Space 判定，接口预留扩展。
- 能力令牌：Ed25519 JWT，绑定 assignment、spaceId、ticketId、工具白名单、动作上限与有效期；子代理取父级子集。
- 可选第二道：敏感表 RLS 按 spaceId；默认关闭，按需开启。
- 不引入关系型授权服务：出现跨空间共享、委派或文档授权时另立设计。

## 六、文件结构与模块职责

路径相对 `apps/api/src/modules/iam/`：入口为 `user.controller.ts`、`role.controller.ts`、`permission-point.controller.ts`、`space.controller.ts`、`navigation.controller.ts` 与 `dto/`；领域 `domain/`；应用 `application/`；基础设施 `infrastructure/`。

分层约束：领域层不依赖框架与 ORM；应用层不 import 基础设施；模块入口是唯一组合根；对外只导出应用服务。

## 七、数据模型

| 表                           | 关键字段                                                   | 约束                                       |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `iam_users`                  | id、username、name、email、passwordHash、status            | username/email 唯一                        |
| `iam_roles`                  | id、code、name、isBuiltin                                  | code 唯一                                  |
| `iam_permission_points`      | code、summary、deprecated                                  | code 主键                                  |
| `iam_role_permission_points` | roleId、permissionCode                                     | 联合主键                                   |
| `iam_user_roles`             | userId、roleId                                             | 联合主键（过渡；由 role_assignments 统一） |
| `iam_role_assignments`       | id、roleId、principalType、principalId、scopeType、scopeId | (主体, 角色, 作用域) 唯一                  |
| `iam_spaces`                 | id、key、name、status                                      | key 唯一                                   |
| `iam_space_members`          | spaceId、userId、status、joinedAt                          | (spaceId, userId) 唯一                     |
| `iam_navigation_nodes`       | code、path、permissionCode                                 | code 唯一                                  |

## 八、接口与契约

| 方法与路径                                | 权限                          | 行为             |
| ----------------------------------------- | ----------------------------- | ---------------- |
| `GET/POST/PATCH /iam/users`               | `iam.user:manage`             | 用户维护         |
| `GET/POST/PATCH /iam/roles`               | `iam.role:manage`             | 角色与权限点授予 |
| `GET /iam/permission-points`              | `iam.permission-point:manage` | 权限点目录       |
| `GET /iam/navigation-nodes`               | `iam.navigation:manage`       | 导航节点         |
| `GET/POST/PATCH /iam/spaces`              | `iam.space:manage`            | 空间维护         |
| `GET/POST/DELETE /iam/spaces/:id/members` | `iam.space:manage`            | 成员维护         |
| `GET /iam/me`                             | 登录即可                      | 会话与可见导航   |

页面路由：`/iam/{users,roles,spaces,navigation,permission-points}`，与 API 首段同域（ADR-0080）。

运行时契约：`can(actor, action, resource)`、`listVisible(actor, type)`、`toPredicate(actor, type)`；业务不得自行拼权限判断。

## 九、扩展与接入

- 新增权限点：在共享目录登记，启动同步到投影表。
- 新增资源类型：在资源表加 spaceId，并在授权服务中登记可见性规则。
- 关系型授权：出现跨空间共享、委派或文档级授权时，新增适配实现与 ADR；接口不变。
- 新身份来源：可在会话层对接外部身份，但角色与权限仍以本域为准。

## 十、部署与运维

api 与 worker 同镜像；会话与权限实时查询，不设权限集合缓存；变更即时生效；审计记录允许与拒绝；敏感表 RLS 可选。

## 十一、设计边界、风险与待决项

| 项       | 风险或边界                                 |
| -------- | ------------------------------------------ |
| 实时查询 | 每请求查询角色与成员，需索引与连接池保障   |
| 越权语义 | 404 与 403 必须严格区分，避免存在性泄露    |
| 令牌     | 签发、续期、撤销需与 assignment 状态机对齐 |
| 关系授权 | 当前不支持共享与委派，出现时需另立设计     |
| 多空间   | 用户属于多个空间时可见性取并集，规则需评审 |

## 十二、变更记录

| 日期       | 变更                                           | 原因     | 作者 |
| ---------- | ---------------------------------------------- | -------- | ---- |
| 2026-11-17 | 按限界上下文拆分；Space 边界、动作词与能力令牌 | 架构对齐 | lead |
