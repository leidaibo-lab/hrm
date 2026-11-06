# HRM 协作规则

- 默认中文协作。开始先检查git status、README、pnpm-workspace.yaml及相关应用文件；不读取或输出真实.env。
- 本仓库是业务应用：apps/web为Next.js，apps/api为NestJS，packages/database拥有Prisma schema、迁移与客户端。Mastra编排仍在ai-platform，不复制平台Runtime或评测数据库。
- 使用Node24、pnpm10.6.0和唯一根pnpm-lock.yaml；内部依赖使用workspace:*，不混用npm/yarn锁文件。
- 业务功能来自持久化且已由用户确认的产品版本。当前骨架只做环境探针，不把历史Ticket评测或未批准建议写成招聘规则。
- 每个函数、构造方法、箭头函数及回调附近均写职责注释。公共契约明确类型、可空性、所有权与错误边界，保持KISS，不添加没有使用者的抽象。
- 修改前阅读docs/decisions；影响API、数据库或权限时先写清契约与迁移方案。提交遵守type(scope): 中文说明。
- 交付须记录实际check/build/smoke结果，浏览器交互与HTTP检查分开，不能冒称生产验收。
- Docker使用显式desktop-linux context；本地预览保留数据卷，pnpm docker:down不删除卷。只有用户明确要求才清空数据库。
