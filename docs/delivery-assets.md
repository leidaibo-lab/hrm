# 一个业务仓库承接产研交付

2026-11-07 用户确定业务资产统一归 leidaibo-lab/hrm。当前为本地目录/资料/导出接线，远程提交、代码执行及实际归档业务验收分别报告。

| 资产 | 权威落点 | 读取来源 |
| --- | --- | --- |
| 原始诉求与外部资料 | product/sources + manifest.json | 产品角色只读该目录，实际工具读取另留证据 |
| PRD、产品审阅、方案与任务 | product/runs | 本 Run 生成和人工批准，历史稿不自动成为新需求 |
| 前端/API/数据模型代码 | apps/web、apps/api、packages/database | 固定仓库基线 commit 和批准工作树（接入待办） |
| 用例、测试报告与缺陷 | testSet/runs | 批准需求、实际候选、登记套件与人工结果 |
| 上线文档、发布与回滚记录 | deploy/runs | 批准范围、真实外部任务与健康回执 |
| 流程/暂停/审批事实 | Mastra 原生 LibSQL | ai-platform 独立运行数据库，Git 为交付投影 |

## 来源与版本

每次导出包含 Run ID、stage、mode、业务版本及文件 SHA256。资料清单中的 pm-hrm 为参考，未登记具体复制内容前不视为 Agent 已加载。当前用户确认和批准产品稿决定实施范围；本期仍为初筛与邀约记录，不因参考资料含面试/录用等而扩张。

资料目录变更应通过 Git 留痕。待建设逐 Run 冻结资料快照和工具引用校验；当前导出散列仅为归档时观察，不证明生成时读到了全部资料。

## 当前已接与待办

目录、来源登记和宿主归档接线可落地；候选代码仍由 ai-platform 受限运行目录持有。写入工作树不等于 commit/push，导出为可重建副本，不能靠手工修改导出记录批准或恢复流程。

1. 项目/迭代/根 Run 关联已接入；后续补业务 change、仓库 baseline commit、分支、工作树与可写路径的机器绑定。
2. 代码补丁回库、commit/PR、冲突和人工修改保留；并行 Run 不能共享可变候选。
3. 将执行器从固定 .mjs 扩展到批准的 pnpm 安装/检查/构建、Next/Nest/Prisma 和浏览器测试；安装与执行隔离。
4. 独立测试脚本与用例复用、测试数据/环境准备、缺陷跨轮关联。
5. CI 权限与流程激活、镜像/制品 Registry、源码 commit 到 digest 的机器绑定、真实发布/健康/回滚。
6. 人工审批身份、外部附件引用、备份恢复及保留清理；大资源放成熟资产系统而非 Git。
7. 新 Run 完整验证归档、幂等、失败后补导出及恢复；本轮按要求不运行测试或业务 Run。

## 权限与历史

产品 Agent 仅能读 sources，不能编辑评审/评分。宿主只写三个资产根目录，已有同版本文件冲突报错，不覆盖。密钥与数据库不归档；发布回执必须脱敏。用户原始隐私材料不能自动公开到 GitHub（当前仓库公开）。历史运行数据保留，不批量伪造迁移为新流程已批准资产。

## 项目、迭代和只读产物目录（2026-11-07）

Mastra 新 Run 输入 `iterationId` 和 `brief`；项目固定 hrm，未指定迭代明确使用 unassigned。初始化生成 product/catalog 下项目、迭代和 Run 记录，保存关联与原始 briefHash。同 Run 不能换迭代或需求；内部子流程继承根 Run。

各角色节点完成和暂停前导出，manifest v2 保存 correlation、创建时间及每文件 SHA256。统一清单从 product/testSet/deploy 的完成 manifest 按需重建，不维护第二套审批状态。旧 v1 无关联清单显示未关联历史，不从文件时间猜归属。

本地查看入口：<http://127.0.0.1:4111/delivery-assets>，服务由 ai-platform/practices/mastra 的 `npm run dev` 提供。可按迭代、Run、阶段查看所有历史版本，纯文本预览、校验后下载单文件或 JSON 包。链接回 Studio 查原生 Run；此页无批准或恢复操作。GET catalog/file/bundle 路由均在 `/delivery-assets` 下，不带 `/api`。

完整关联结构、角色产物清单、接口及数据流转图由 ai-platform 的 `practices/mastra/artifact-dataflow.md` 维护，图源为 `docs/assets/mastra-hrm-artifact-dataflow.svg`、同名 PNG。当前只读 HTTP 与类型检查通过；按要求未运行测试、模型业务 Run 或部署，初始空目录是真实状态，实际自动归档/恢复及有内容下载仍待验收。没有执行 commit/push。
