# ADR-0053 工具级有效权限（触发人权限 ∩ 角色工具白名单）

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

把有效权限公式接到 agent 工具调用：

- **触发人权限解析**：`ACTOR_PERMISSION_PORT`，适配器复用 IAM `UserService.findSessionUser`（权限点实时展开，撤销下一请求生效）；未知/非 active 用户返回 null。
- **工具权限映射**：`permissionForTool`（`read-ticket`/`search-similar`/`read-document` → `ticket:read`），未登记工具拒绝。
- **判定**：`ToolAccessService.authorize` = 角色工具白名单 ∩ 触发人权限点；无 actor（系统/未绑定用户）拒绝工具调用。
- **接入**：澄清/拆解/研判 runtime 装配工具时注入 `authorize` 回调；工具执行前校验，失败抛「工具权限不足」，不返回越权数据。
- **范围**：工单/线程读取仍由工具自身 `scopeKey` 过滤；有效权限公式的资源范围条件在工具侧复用该过滤。
- **检查设施**：AgenticModule 新增 IAM 模块依赖与端口 provider；无 HTTP 端点/权限矩阵变更，protected 基线不变。

## 被否决的选项

- **在工具内直接查 IAM**：工具应保持无框架依赖，且会复制权限展开逻辑。
- **只在 HTTP 守卫校验**：agent 工具调用不经过 HTTP，必须在使用点校验。
- **无 actor 时放行**：会让系统触发成为越权跳板，按安全优先拒绝。

## 后果与回滚

- 未绑定平台用户（如纯群消息）的触发无法使用工具；这是安全优先的 V0 取舍，需在策略中引导绑定或使用固定负责人。
- 每次工具调用一次 IAM 查询；工具调用频率低，V0 可接受。
- 回滚：移除工具 `authorize` 回调与 W 模块依赖，行为回到仅 scope 过滤。
