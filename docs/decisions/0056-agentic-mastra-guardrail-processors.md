# ADR-0056 Mastra 护栏 Processor 正式接线

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

把注入检测与 PII 脱敏从「仅提示词层」提升为 Mastra Agent 的正式 Processor，形成模型侧强制护栏：

- **输入处理器** `injectionGuardProcessor`：检查消息文本，命中 `ignore previous instructions`/系统提示词/角色覆盖等特征即 `abort`，不进入模型。
- **输出处理器** `piiRedactionProcessor`：对模型输出消息的文本字段递归脱敏邮箱/手机号/身份证，保持结构化输出其余字段不变。
- **接线**：澄清、拆解、研判三个 `Agent` 的 `inputProcessors`/`outputProcessors` 注入；提示词层的 `guardPrompt` 继续保留，形成双层防线。
- **位置**：与既有护栏函数同放 `infrastructure/runtime/guardrail.helper.ts`，避免新增 `processor` 文件角色（命名约定属 L3，未获确认前不放宽）。
- **不改变**：token 预算仍由 runtime 读取 usage 断言；未引入数据库/端点变更。

## 被否决的选项

- **只保留提示词层**：模型仍可能执行注入；Processor 可在调用前短路。
- **在工具层做注入检测**：工具调用发生在模型输出之后，已错过输入防护时机。
- **输出层重写整个结构化 JSON**：可能破坏 schema；只改文本字段。

## 后果与回滚

- 误报注入会导致该次运行失败并转人工关注（已有失败兜底）；特征表保守。
- 回滚：移除 Agent 的 processors 配置与目录，提示词层护栏仍在。
