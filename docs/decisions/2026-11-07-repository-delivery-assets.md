# 统一交付资产到 HRM 仓库

- 状态：接受，用户指定 product、testSet、deploy 及业务代码统一归本仓库。
- 日期：2026-11-07

采用 Git 管理可评审业务资产，适配 Mastra 原生 Workspace/LibSQL 和薄归档 Adapter。未采用另建文档/用例/发布平台，因为当前单项目可用 Markdown/JSON 和 Git 关联。Actions/Registry 用于后续执行和大制品，不用 Git 保存数据库/镜像。

来源为已确认原始诉求；pm-hrm 仅登记参考，不搬其完整范围。目录与数据规则见 [交付资产约定](../delivery-assets.md)。Mastra 编排、运行数据库留在 ai-platform。源码基线、Git 回库、pnpm 全栈执行和 CI 发布尚待接入，不能以目录创建或文档归档证明这些能力已完成。

维护者为 HRM/Mastra 项目负责人；出现多人并行编辑、生产权限或大量附件时重评工作树隔离/外部资产管理。退出时可直接保留 Markdown/JSON 与 Git 历史，不重建审批状态。验证限定文档与静态检查；本轮不执行测试、业务模型 Run 或部署。
