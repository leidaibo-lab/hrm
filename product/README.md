# 产品与研发交接资产

本目录承接 Mastra 产研流程的可审阅业务产物，编排源码和运行数据库仍在 ai-platform。

- `sources/`：允许产品角色读取的原始业务资料，来源清单见 [manifest.json](./sources/manifest.json)。当前只有原始 brief 和来源登记，不包含历史评分或参考答案。
- `runs/<runId>/<stage>/<hash>/`：宿主导出的原始诉求、四角色稿、PRD、产品审批投影、技术方案、任务、团队、评审及研发交付元数据。按实际执行生成，不预填已批准内容。
- `runs/` 下产物不可覆盖，同版本重导出核对字节；审批、暂停和恢复以 Mastra 原生存储为准。

资料效力：当前用户确认及本 Run 批准需求优先；pm-hrm 仅作参考，冲突必须列为待确认，不静默覆盖。原始 brief 不等于完整批准 PRD。导出时观察的资料散列不等于模型生成时实际读取证据。

业务代码归 apps/web、apps/api、packages/database；代码回库、仓库基线和构建来源仍需执行器适配。目录契约及待办见 [交付资产约定](../docs/delivery-assets.md)。

`catalog/projects/hrm` 保存项目与迭代登记，`catalog/runs/<rootRunId>/run.json` 保存不可变 Run 关联与初始 briefHash；不保存审批状态。查看/下载通过 Mastra 同服务 `/delivery-assets`，详见 [资产约定](../docs/delivery-assets.md)。
