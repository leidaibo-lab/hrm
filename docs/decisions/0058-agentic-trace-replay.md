# ADR-0058 agentic 运行回放入口与依据审计

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

补齐 `security.md` §4.8 的运行审计字段与 `runtime.md`「运行轨迹可按 traceId 还原」：

- **写入**：`agentic.run` 审计详情新增 `mandateId`、`policyVersion`、`triggerIds`、`artifactId/artifactKind/artifactVersion`、耗时、tokens 与步骤名；内部 `internal.run.start` 同样记录 `mandateId`。
- **读取**：新增 `GET /agentic/audit/traces/:traceId`，按 traceId 返回 `runs`（运行）、`steps`（去重步骤名）、`artifacts`（产物）、`basis`（mandate/策略版本/依据事件）与原始 `items`；权限沿用 `audit:read`，按 `scopeKey` 行级过滤，无可见记录返回 404。
- **不落参数**：工具入参与结果不在本轮落库；参数级轨迹与脱敏属 V1-9，避免把敏感输入直接写进审计。
- **Web**：`/console` 运行轨迹直接展示角色、结果、耗时、tokens、步骤名、mandate、策略版本与产物标识；聚合接口供后续 ai-elements 与按 trace 详情页消费。

## 被否决的选项

- **新建运行表**：与 `audit_logs` 重复，且会绕过统一审计出口。
- **按工单查产物**：产物无法与某次 trace 对应，回放会出现跨运行混合。
- **本轮落工具参数**：未经脱敏的文档正文与工单内容进入审计，风险高于收益；留待 V1-9 与 `auditRedactFields` 一起做。

## 验证

2026-11-16：新增 `audit-record-view.service` 的聚合单测（运行/步骤/产物/依据、空集合）；worker 审计单测断言 `mandateId/policyVersion/triggerIds`；端点权限矩阵快照更新；API 630 项单测、Web 59 项测试、API/Web typecheck 通过。未做真实数据库端到端回放。

## 后果与回滚

- 审计详情为 JSON，新增字段向后兼容；旧记录回放时缺失字段会省略，不报错。
- 回放接口只读，不写库、不重复执行副作用。
- 回滚：移除路由与 `toTraceReplay`，worker 继续写原字段；已写入的审计保留。
