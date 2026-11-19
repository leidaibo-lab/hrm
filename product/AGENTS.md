# 产品、开发和测试共用 OpenSpec

从 `product/` 运行 OpenSpec。产品、开发和测试将各自的 `spec.md` 写入同一套 `product/openspec/specs/`。

| 工作入口 | 读取依据 | 输出路径 | 规格内容 |
| --- | --- | --- | --- |
| `product/` | `product/<迭代标识>/requirements.md` 中已确认的规则与验收条件 | `product/openspec/specs/<迭代标识>/spec.md` | 业务规则、触发条件、可观察结果 |
| HRM 仓库根目录 | 本轮获准开发的需求、产品规格和固定工程基线 | `product/openspec/specs/development-<迭代标识>/spec.md` | 实施约束、模块或接口边界、可验证的开发结果 |
| `testSet/` | 本轮已确认的需求与产品规格 | `product/openspec/specs/testing-<迭代标识>/spec.md` | 测试前置条件、操作、预期结果和需要记录的证据 |

1. 产品需求生成或修订后，在本轮交接中根据表中路径生成产品规格。开发按获准实施的范围生成开发规格，测试按获准验收的范围生成测试规格。
2. 在 `## Purpose` 下写本规格的目的并链接来源。开发和测试规格同时链接同版产品规格或注明固定提交。沿用原 `REQ-` 标识，可在 `### Requirement:` 标题中使用，或在对应条目中明确列出关联 ID。
3. 在 `## Requirements` 下用 `### Requirement:` 和 `SHALL` 定义要求，用 `#### Scenario:`、`WHEN`、`THEN` 和适用的 `AND` 描述可观察结果。产品稿存在影响验收的矛盾或未决项时，反馈至需求审阅。测试执行结果记录到 `testSet/runs/`。
4. 每次规格生成的唯一产物是表中对应的 `spec.md`。同一迭代的修订更新对应规格。覆盖范围按本阶段负责的需求核对。
5. 从 `product/` 执行 `openspec validate <规格目录名> --type spec --strict`。三类规格齐备时执行 `openspec validate --specs --strict`。核对需求引用、拒绝结果和数据影响，确认角色间的预期一致。
