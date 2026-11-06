# 初始化记录（2026-11-06）

## 用户确认与边界

用户指定GitHub仓库leidaibo-lab/hrm并采用pnpm monorepo，确认apps/web（Next.js）、apps/api（NestJS）、packages/database（Prisma），Mastra产研编排留在ai-platform。初始化前远程仓库为空。本轮不实现招聘实体、权限或未确认的产品规则，也不将历史Ticket候选导入业务仓库。

## 结构、数据与模式

采用pnpm原生workspace及workspace:*，仅根pnpm-lock.yaml，固定pnpm10.6.0/Node24；通过pnpm递归拓扑构建管理三个包。数据库包提供Prisma客户端Factory，API中的Nest DI服务拥有创建、探针与关闭生命周期。schema暂不含业务模型，健康查询仅SELECT 1；查询/连接超时5秒。API探针仅返回固定状态及503，不返回连接串或底层异常。前端通过同源代理访问API，未引入额外调度框架。

## 已执行验证

本机Node24.22.1、pnpm10.6.0：

- pnpm install及--frozen-lockfile通过；全仓没有npm/yarn平行锁文件。
- 空业务schema的Prisma7.10.1 generate与validate通过，不为生成客户端创建占位业务表。
- pnpm check通过，包括Next typegen、数据库/API/前端类型检查。
- pnpm build通过，包括Prisma生成、数据库包、Nest TS及Next生产构建。
- 宿主API dev模式启动通过：/api/health/live返回200，数据库故意不可达时/api/health/ready返回固定503且不泄露连接信息；临时进程已关闭。
- Compose配置解析通过；最初版本镜像构建及web/api/db容器内部健康检查通过。
- 最初纯internal网络未发布宿主端口，页面smoke实际失败；本地预览已改为普通项目bridge，仅127.0.0.1发布3100/5436，不将此环境视为禁网候选沙箱。
- 对最终配置重建时Docker Desktop的BuildKit metadata_v2.db发生input/output error，此后引擎查询返回EOF。宿主磁盘当时仍有54GiB可用，未据此推断VM存储故障的根因。

最终Dockerfile补充显式OpenSSL/CA，避免Prisma在slim镜像中使用不确定的OpenSSL探测结果。该最终镜像尚因引擎故障未完成构建。浏览器交互、最终网络后的HTTP+数据库链路、GitHub托管CI和招聘业务验收未执行；本记录不将初始容器健康通过冒称最终预览通过。原始日志与散列保存在忽略目录.data/bootstrap/2026-11-06/。

## 续办清单

- [ ] 用户确认后重启Docker Desktop，执行pnpm docker:up并核对hrm三个服务健康。
- [ ] 执行pnpm smoke，验证127.0.0.1:3100页面及同源数据库就绪API。
- [ ] 真实浏览器点击就绪检查、验证窄视口、加载/失败状态。
- [ ] 当前OAuth凭据缺少workflow scope，GitHub拒绝创建Actions文件。CI暂保留为docs/ci.example.yml模板；获得权限后移到.github/workflows/ci.yml并检查实际运行结果，不能将模板当作已启用CI。
- [ ] 绑定用户在产品Workflow确认的Run/hash与仓库基线，再生成可审批的业务开发方案。

业务应用代码不继承Mastra开发工具的任意Git、Docker或生产部署权限。后续业务实现与审批记录独立于本次工程初始化。
