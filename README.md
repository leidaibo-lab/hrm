# HRM

HRM业务应用仓库，使用pnpm monorepo。Mastra产研编排继续由ai-platform负责，本仓库统一保存业务代码、产品、测试和发布交付资源。当前已落地技术部前端招聘协作首期闭环，业务基线见[招聘协作PRD](./product/HRM招聘协作_PRD_V1.0.md)。

## 目录

```text
apps/web             Next.js / React页面与同源API代理
apps/api             NestJS业务API、进程存活与数据库就绪探针
packages/database    Prisma schema、客户端工厂及后续迁移
scripts              可复跑环境smoke
product              原始资料、PRD及技术交接产物
testSet              测试用例、报告、缺陷与回归记录
deploy               上线文档、发布/健康/回滚记录
```

版本沿用已选全栈基线：Node24、pnpm10.6.0、Next16.4.5、React19.3.1、Nest12.4.0、Prisma7.10.1。全仓仅一个pnpm-lock.yaml；包间依赖使用workspace:*。

## 安装与检查

```bash
nvm use
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

## Docker Desktop本地预览

```bash
pnpm docker:up
pnpm smoke
pnpm docker:logs
pnpm docker:down
```

启动入口显式使用desktop-linux context，在Docker Desktop中显示为hrm Compose项目。浏览器打开http://127.0.0.1:3100，点击“检查API与数据库”。数据库仅绑定127.0.0.1:5436，供本机开发工具访问。密码是公开本地样例，不连接真实业务数据；不复制ai-platform密钥。docker:down停止项目并保留数据卷，不自动清库。

## 宿主开发

仅启动数据库后，在终端分别运行API和web：

```bash
docker --context desktop-linux compose up -d --wait db
cp .env.example .env
pnpm db:generate
pnpm --filter @hrm/database build
pnpm dev:api
# 另一终端
pnpm dev:web
```

API读取本机.env；web以同源/api代理127.0.0.1:3001。schema暂不含业务实体，不产生业务迁移；后续业务模型获批后使用pnpm db:migrate生成可审查迁移，再用pnpm db:deploy应用已保存迁移。

## 验证与边界

CI模板保存在[docs/ci.example.yml](./docs/ci.example.yml)；当前GitHub凭据缺少workflow权限，尚未激活托管CI。获得权限后移到.github/workflows/ci.yml即可触发。

实际验证结果见[初始化记录](./docs/bootstrap-2026-11-06.md)，架构取舍见[决策](./docs/decisions/2026-11-06-pnpm-monorepo.md)。已通过本机类型检查、生产构建、最终Docker镜像构建、页面/API/数据库smoke，以及浏览器成功、失败恢复与390px窄视口验证。健康检查不代表招聘功能、身份权限、产品审批或生产部署通过。

资产落地、资料来源与未接环节见[交付资产约定](./docs/delivery-assets.md)。新流程归档写本地工作树，不自动提交或推送；实际能力以对应执行证据为准。
