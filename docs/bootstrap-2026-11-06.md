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

最终Dockerfile补充显式OpenSSL/CA，避免Prisma在slim镜像中使用不确定的OpenSSL探测结果。初次最终构建受到上述引擎故障阻塞；用户授权重启后的实测结果如下，历史故障日志继续保留。原始日志与散列保存在忽略目录.data/bootstrap/2026-11-06/。

## 用户授权重启后的复验

2026-11-06用户明确允许重启Docker Desktop。普通restart因旧进程无法退出超时；随后使用官方CLI的stop --force和start成功恢复，引擎仍为29.5.3。没有重置Docker存储、清理其他项目资源或删除数据卷，不据重启恢复断言I/O错误根因已查明。

- 最终Dockerfile重建成功，包括OpenSSL/CA、冻结锁文件安装、禁网pnpm build，以及Next/Nest/Prisma产物。
- pnpm docker:up对应的Compose启动完成，web/api/db均为running/healthy；宿主仅127.0.0.1发布3100与5436。
- pnpm smoke通过：页面200且包含环境检查内容，同源/api/health/ready返回200与{status:ok,database:ok}，实际执行Prisma SELECT 1。
- Chrome实际点击“检查API与数据库”显示“API与数据库已就绪”。停止本项目db后再次点击，页面显示服务尚未就绪；恢复db并重试后再次显示已就绪。
- Chrome以390×844视口检查，documentWidth=390，无横向溢出，检查按钮与状态均可见；结束后恢复默认视口。加载中状态未单独采样，不据成功/失败结果宣称加载状态已验收。
- 原hrm_hrm-data卷创建时间仍为2026-11-06T14:44:49Z，本轮未删除或重建数据卷；只是探针连通性验证，没有创建业务记录，不构成业务持久化验收。

本轮结束保留hrm服务运行和Chrome预览页。证据包括restart-verification.json、compose-after-restart.jsonl、重启/构建/smoke日志及三个浏览器截图，保存在上述忽略目录。GitHub托管CI、招聘功能与产品审批仍未验收。

## 续办清单

- [x] 按用户授权重启Docker Desktop，最终镜像构建成功且hrm三个服务健康。
- [x] 执行pnpm smoke，验证127.0.0.1:3100页面及同源数据库就绪API。
- [x] 真实浏览器点击就绪检查、验证390px窄视口及数据库失败/恢复重试。
- [ ] 如需完整交互验收，补可控慢响应下的加载中与重复点击检查。
- [ ] 当前OAuth凭据缺少workflow scope，GitHub拒绝创建Actions文件。CI暂保留为docs/ci.example.yml模板；获得权限后移到.github/workflows/ci.yml并检查实际运行结果，不能将模板当作已启用CI。
- [ ] 绑定用户在产品Workflow确认的Run/hash与仓库基线，再生成可审批的业务开发方案。

业务应用代码不继承Mastra开发工具的任意Git、Docker或生产部署权限。后续业务实现与审批记录独立于本次工程初始化。
