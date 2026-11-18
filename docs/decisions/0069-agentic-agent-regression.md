# ADR-0069 agentic Agent 回归用例与发布门禁

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

> 后续：发布门禁与 AgentVersion 已由 ADR-0074 移除；回归改为手动/CI。

## 决定

给 Agent 版本发布加可运行的回归检查，并提供种子用例集：

- **种子用例**：`CLARIFY_REGRESSION_CASES` 覆盖导出、缺陷、异步改造三类澄清输入；每条含 `id/text/expectedKeywords`。产品可按同一结构补充，不需要改代码接口。
- **评分**：用 main 档澄清角色对每条输入生成结构化输出，按期望关键词在输出 JSON 中的覆盖率计分（0–1）；单条按阈值判通过，整体要求全部用例通过。
- **阈值**：策略 `regressionThreshold`（0–1，缺省 0.8）；命令/接口可显式覆盖。
- **接口**：`POST /agentic/agents/:key/regression`，权限 `agent:configure`，返回分数、阈值与每条缺失关键词；当前只覆盖 `clarify`，其他角色返回 400。
- **发布门禁**：策略 `regressionRequired=true` 时，`POST /agentic/agents` 在登记版本前调用 `assertPassing`，未达标 400；缺省 false，避免无模型环境阻塞版本登记。
- **不自动改状态**：回归只读，不写 AgentVersion，不触发发布。

## 被否决的选项

- **每次发布都强制调模型**：无供应商/离线环境会阻塞版本登记；用策略显式开启。
- **LLM-as-judge 打分**：结果不确定且成本高；种子阶段用关键词覆盖率，后续可替换评分端口实现。
- **把用例写进数据库**：当前无管理界面与版本化需求；代码内种子集更易审查与回滚。
- **只做接口不接发布**：无法满足「发布前达标」；用可选门禁接入，默认关闭但可一键开启。

## 验证

2026-11-16：`agent-regression.service.spec` 覆盖策略阈值/默认 0.8/未达标抛错；`mastra-agent-regression.service.spec` 覆盖关键词覆盖率、未知角色与缺策略；`agent-version.controller.spec` 更新构造；新增端点权限矩阵快照。API 全量单测、typecheck、lint、docs/rules 通过。真实模型下的分数分布与阈值合理性未验证。

## 后果与回滚

- 种子集只有 3 条，覆盖有限；产品补充后阈值才有统计意义。
- 开启 `regressionRequired` 后，每次发布多一次模型调用；失败会阻止版本登记。
- 回滚：删除策略键或移除 controller 门禁；已登记版本不受影响。
