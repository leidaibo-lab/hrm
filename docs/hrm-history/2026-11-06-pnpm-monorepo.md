# HRM业务仓库采用pnpm workspace

- 日期：2026-11-06
- 状态：用户确认仓库与pnpm monorepo；基础工程已实现；引擎重启后最终容器与浏览器验证通过
- 仓库：leidaibo-lab/hrm

## 边界与选择

用户指定hrm为业务仓库，确认apps/web（Next.js）、apps/api（NestJS）、packages/database（Prisma），Mastra编排保留ai-platform。复用现有全栈试点验证的版本基线，不把Ticket参考实现或生成候选当作HRM需求。

比较pnpm原生workspace、pnpm+Turborepo及pnpm+Nx。采用原生workspace：目前仅三个包，原生拓扑执行和workspace协议足够；延后缓存调度和生成器，避免维护尚无需求的配置。存在大量应用、复杂依赖或CI缓存需求时再评估Turbo/Nx。pnpm版本固定10.6.0，Node24；仅根目录锁文件。

数据库包拥有schema和Prisma客户端工厂，API拥有连接生命周期。初始schema不预设招聘实体；固定SELECT 1只检验连通，不保存业务数据。前端同源代理API，不把数据库地址或Mastra凭据发给浏览器。

## 本地运行

Docker Desktop Compose为hrm提供web/api/db，明确服务健康检查，采用普通项目bridge网络并仅loopback发布预览与本地数据库端口。实测Docker29纯internal网络不发布宿主端口，故本地预览不套用离线候选验收的internal网络；不将此环境宣称为禁网沙箱。与一次性能力评测不同，本地预览不自动删除容器/数据。固定构建在依赖安装后禁网；候选不挂载宿主目录。数据库凭据仅是提交可见的本地样例，不用于生产。

## 维护、退出与重评

维护者为项目开发负责人。所有权以包依赖和schema为依据，不建立通用仓库执行引擎。迁回单包仅需合并应用脚本与依赖，业务数据仍由PostgreSQL拥有。引入真实账号、生产数据、外网部署或Mastra执行工具时须新建决策。

官方依据：pnpm工作区https://pnpm.io/workspaces；Docker Compose https://docs.docker.com/compose/；Prisma配置https://www.prisma.io/docs/orm/reference/prisma-config-reference。实际版本以锁文件和执行记录为准。
