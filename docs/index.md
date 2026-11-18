# 文件地图

> 层：描述 · 时态：描述现在 · 失效：目录或文件变化时

## 入口

| 目的                               | 位置                 |
| ---------------------------------- | -------------------- |
| agent 入口：读取顺序与不可协商项   | `AGENTS.md`          |
| 指令入口别名（其它工具约定）       | `CLAUDE.md`          |
| 文档角色、拆分判据、生长与删除规则 | `docs/governance.md` |

## 现行文档

篇数与逐篇行数上限的唯一定义见 `docs/governance.md`「规模预算」；本文件（`docs/index.md`）是现行文档清单的唯一来源。

| 目的                                                   | 位置                                      |
| ------------------------------------------------------ | ----------------------------------------- |
| 任务分级、推进循环、退出条件、提交信息                 | `docs/process/workflow.md`                |
| 权限分层、红线、事实确认、破坏性操作检查               | `docs/process/boundaries.md`              |
| 后端结构与依赖：分层、目录基线、模块系统、工具链       | `docs/conventions/architecture.md`        |
| 接口契约：OpenAPI 管线、响应/错误、路由、分页、codegen | `docs/conventions/contracts.md`           |
| 数据访问与基础设施：查询、事务、并发、迁移             | `docs/conventions/persistence.md`         |
| 权限域：权限点目录、同步投影、guard、前端消费          | `docs/conventions/authorization.md`       |
| 文件、函数、类型命名与角色表                           | `docs/conventions/naming.md`              |
| 文档写作与产出物规范                                   | `docs/conventions/documentation.md`       |
| 前端结构：分层、RSC、切片、数据流转、组件划分          | `docs/conventions/frontend.md`            |
| 视觉与交互：令牌、层级、壳层、表格交互、响应式         | `docs/conventions/web-ui.md`              |
| 组件契约：尺寸、状态、焦点、图标、动效                 | `docs/conventions/web-ui-components.md`   |
| 表单：状态、校验、错误展示、可访问性                   | `docs/conventions/forms.md`               |
| 测试分层、放置与 mock 纪律                             | `docs/conventions/testing.md`             |
| 代码注释（JSDoc）                                      | `docs/conventions/code-comments.md`       |
| 当前架构总览（描述现状，不是规则）                     | `docs/reference/architecture-overview.md` |
| 命令注册表、验证矩阵、规则→检查映射                    | `docs/reference/verification.md`          |
| 通用编码：类型、空值、控制流、异步与错误               | `docs/conventions/code-quality.md`        |
| 数据库：表、字段、约束、关系、索引与精度               | `docs/conventions/database.md`            |
| 安全：敏感数据、密钥、信任边界与资源限制               | `docs/conventions/security.md`            |
| 运行：超时、重试、缓存、任务、日志与恢复               | `docs/conventions/runtime.md`             |

## 按任务选择

| 我要做的事                               | 先读                                                                   | 再看                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 不知道从哪开始                           | `AGENTS.md`                                                            | `docs/reference/verification.md`                                            |
| 改代码但不知道验证到什么程度             | `docs/process/workflow.md`                                             | `docs/reference/verification.md`                                            |
| 新增 / 修改 API 端点、响应、错误码、路由 | `docs/conventions/contracts.md`                                        | `docs/conventions/testing.md`                                               |
| 改 Prisma model / 迁移 / mapper          | `docs/conventions/database.md`                                         | `docs/conventions/persistence.md`                                           |
| 建 / 改后端模块结构、分层、依赖          | `docs/conventions/architecture.md`                                     | `docs/conventions/naming.md`                                                |
| 新建 / 重命名文件、函数、类型            | `docs/conventions/naming.md`                                           | `docs/conventions/architecture.md`                                          |
| 建带权限的业务模块                       | `docs/conventions/authorization.md`                                    | `docs/conventions/architecture.md`（实施步骤见 `docs/process/workflow.md`） |
| 加 / 改前端页面、组件、数据请求          | `docs/conventions/frontend.md`                                         | `docs/conventions/web-ui.md`                                                |
| 改视觉令牌、壳层、表格交互               | `docs/conventions/web-ui.md`                                           | `docs/conventions/frontend.md`                                              |
| 改组件尺寸、状态、焦点、图标、动效       | `docs/conventions/web-ui-components.md`                                | `docs/conventions/web-ui.md`                                                |
| 写 / 改表单                              | `docs/conventions/forms.md`                                            | `docs/conventions/frontend.md`                                              |
| 写 / 改测试                              | `docs/conventions/testing.md`                                          | —                                                                           |
| 写 / 改代码注释                          | `docs/conventions/code-comments.md`                                    | —                                                                           |
| 写文档或提交信息                         | `docs/conventions/documentation.md`                                    | `docs/process/workflow.md`                                                  |
| 实现 agentic 功能                        | `docs/prd/agentic/index.md` / `docs/prd/agentic/design.md`             | `docs/conventions/architecture.md`                                          |
| 实现模型网关功能                         | `docs/prd/model-gateway/index.md` / `docs/prd/model-gateway/design.md` | `docs/conventions/architecture.md`                                          |
| 实现身份与访问功能                       | `docs/prd/iam/index.md` / `docs/prd/iam/design.md`                     | `docs/conventions/authorization.md`                                         |
| 实现已立项功能 / 写需求文档              | `docs/prd/` 对应篇（模板 `docs/prd/_TEMPLATE.md`）                     | `docs/conventions/documentation.md`「PRD 产物规范」                         |
| 新增规则或改文档结构                     | `docs/governance.md`                                                   | `docs/conventions/documentation.md`                                         |
| 删除、移动或改配置                       | `docs/process/boundaries.md`                                           | `docs/process/workflow.md` 的 L3                                            |
| 想看懂当前架构全貌                       | `docs/reference/architecture-overview.md`                              | —                                                                           |
| 想知道某个取舍为什么这么定               | `docs/decisions/`                                                      | —                                                                           |
| 写通用 TS/TSX 逻辑                       | `docs/conventions/code-quality.md`                                     | `docs/conventions/code-comments.md`                                         |
| 接入外部系统、密钥、任务或运行保障       | `docs/conventions/runtime.md`                                          | `docs/conventions/security.md`                                              |

## 技术栈

NestJS 12 / Next.js 16.4 / React 19.3 / TypeScript ^5.9 / pnpm 12.9 + turbo 2.11 / Prisma 7.10 / zod 4 / Biome 2.6 / Vitest 5
