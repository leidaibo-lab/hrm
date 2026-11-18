# ADR-0062 agentic 工具调用参数级轨迹

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

把运行轨迹从「工具名」扩到「脱敏后的工具入参/结果」，并接入 ai-elements：

- **采集**：`readToolCalls(output)` 从 Mastra 生成结果的 `steps[].toolCalls[]` 读取 `toolName/args/result/toolCallId`，生成 `{ id, name, input?, output? }`；缺失字段省略。
- **脱敏**：按 `auditRedactFields` 与默认敏感键（`authorization/cookie/password/secret/token`）递归替换为 `[REDACTED]`；所有字符串再过 PII 规则；每个入参/结果 JSON 超过 4000 字符时只保留 `{truncated:true, preview}`。
- **落库**：`agentic.run` 审计详情新增 `toolCalls`；原有 `steps` 保留工具名数组，兼容旧消费方；回放接口返回同结构。
- **展示**：`/console` 运行轨迹使用 `components/ai-elements/tool` 的 `Tool`/`ToolHeader`/`ToolInput`/`ToolOutput`，按调用折叠展开参数与结果。
- **不落**：原始未脱敏负载、模型推理流、完整文档正文；需要原文时按来源与权限回查。

## 被否决的选项

- **只存工具名**：无法解释「为什么这么写」，回放价值不足。
- **原样存 args/result**：工单正文、文档、令牌可能进入审计，违反最小化。
- **单独建 trace 表**：当前量与审计 JSON 匹配，避免新增表与清理策略；超长再拆表。

## 验证

2026-11-16：`guardrail.helper.spec` 覆盖字段/PII 脱敏、4000 字截断、缺失字段与非法结构；`run-trace-panel.spec` 覆盖工具轨迹渲染；API 647 项、Web 59 项测试通过；API/Web typecheck、lint、docs/rules 通过。Mastra 真实工具返回结构未在真实模型下核对。

## 后果与回滚

- 审计体积随工具调用增长，已用 4000 字符上限控制；`auditRedactFields` 可追加业务敏感键。
- 旧运行没有 `toolCalls` 时页面与回放按空处理，不报错。
- 回滚：移除 `readToolCalls` 采集与 UI 渲染，保留 `steps` 即可；已写审计保留。
