# 产品需求生成 OpenSpec

在 `product/` 下完成 `product/<迭代标识>/requirements.md` 的生成或修订后，同一次产品交接继续执行以下步骤。

1. 读取本轮 `requirements.md`，以其中已确认的业务规则和验收条件为依据。遇到会改变场景预期的矛盾或未决项时，先反馈到需求审阅。
2. 将本轮规则写入 `product/openspec/specs/<迭代标识>/spec.md`。在 `## Purpose` 下写业务目的并引用需求原文。在 `## Requirements` 下使用 `### Requirement: REQ-…` 保留原需求 ID，使用 `SHALL` 表达规则，使用 `#### Scenario:` 和 `WHEN`、`THEN`、`AND` 写可观察结果。不同条件产生不同结果时分别写场景。
3. 本步骤的唯一产物是对应的 `spec.md`。修订同一迭代时更新该文件。`requirements.md` 是输入，`proposal.md`、`design.md`、`tasks.md` 和 `product-spec.md` 均不由本步骤生成。
4. 从 `product/` 执行 `openspec validate <迭代标识> --type spec --strict`。逐项比对原需求 ID 和验收场景，检查是否漏掉条件、拒绝结果或数据影响，尤其是权限变化、保存失败与状态保持。
