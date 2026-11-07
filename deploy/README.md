# 发布与运维资产

- `runs/<runId>/<stage>/<hash>/`：版本化上线方案、范围审批、制品引用、发布回执、健康结果及回滚回执，按实际状态生成。
- 后续正式操作手册放 `runbooks/`，发布汇总可放 `releases/`；Dockerfile、compose.yaml 等运行配置保持现有位置，以引用关联。
- 目前没有自动 CI/CD Adapter，实际操作在外部执行并人工回填，不能将方案或目录存在视为已发布。
- 镜像、安装包、数据库、真实环境变量和凭据不入 Git；制品应来自仓库 Registry/CI，记录 digest、任务引用与源码 commit。

CI 模板仍在 docs/ci.example.yml，未因此次目录接入激活。详见 [交付资产约定](../docs/delivery-assets.md)。
