# ADR-0071 飞书 API 基址可配置

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

新增环境变量 `LARK_API_BASE`（默认 `https://open.feishu.cn`），供 token、消息发送、字段写回与表格读取拼接 URL：

- 默认值保持生产行为不变；部署不配置即走官方地址。
- 仅用于本地联调/隔离环境指向假飞书服务；由部署方注入，不暴露给租户或前端。
- 所有请求仍经统一 `HttpService` 的出站策略（ADR-0038）；指向环回/私网时还必须显式配置 `OUTBOUND_ALLOW_PRIVATE_HOSTS`，不会因基址可配置而绕过 SSRF 防护。

## 被否决的选项

- **代码内 mock 传输层**：只能测单元，无法验证真实 token/消息/写回的 HTTP 形状与错误映射。
- **hosts/DNS 劫持**：不可复现，且会污染开发机。
- **把基址放进飞书实例 config**：实例由运营维护，改基址不应影响业务配置，也扩大误配面。

## 验证

2026-11-16 本地假飞书服务（127.0.0.1:3996）：

- token 请求命中 `/open-apis/auth/v3/tenant_access_token/internal`；
- 消息请求命中 `/open-apis/im/v1/messages?receive_id_type=chat_id`，body 含 `receive_id/msg_type/content`；
- outbox 状态 `sent`，`sentAt` 非空，对应 effect 为 `succeeded`；
- 未配置 `OUTBOUND_ALLOW_PRIVATE_HOSTS` 时，环回地址被出站策略拒绝，证明未绕过 SSRF。

## 后果与回滚

- 生产若误配 `LARK_API_BASE`，token/消息会发往错误域名；当前无启动期校验，属于部署配置风险。
- 回滚：删除该环境变量即恢复官方地址。
