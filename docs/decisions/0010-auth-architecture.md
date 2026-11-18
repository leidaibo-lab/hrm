# ADR-0010 认证架构（BFF + provider 可插拔）

> 状态：已接受 · 日期：2026-11-01 · 级别：L3

## 决定

api 作认证中心（BFF，RFC 10017）：token 全部留在服务端，浏览器只持 httpOnly 会话 cookie **`sid`**（`SameSite=Lax`，生产 `Secure`）；会话存 Redis，登出删会话即全端生效。认证 provider 端口可插拔（`AuthProvider` 端口，auth.service 消费）：本阶段只落地 `LocalPasswordProvider`（argon2id）+ 本地注册（注册端点限流，`AUTH_REGISTRATION_ENABLED` 开关，注册用户无角色无权限，由管理员分配）；`ExternalIdentity` 表与 `AuthProvider` 枚举推迟到外部认证落地时随迁移引入。与 ADR-0003 的关系：飞书作为主认证渠道的定位不变，本地账密是先行与备份通道，飞书登录届时以 provider 形式接入。会话安全义务进入实施清单：CSRF（SameSite=Lax + 非 GET 校验 Origin）、登录时 rotate session id、并发会话策略。会话读取契约沿用既有接缝：web `getSession()` → cookie 转发 → `GET /me` → 响应 schema parse；`proxy.ts` 只做登录态乐观重定向，鉴权决策只在 api。

## 被否决的选项

Auth.js（next-auth v5）在 web 侧认证：长期 beta，且把认证职责推进前端层，偏离「web 不承担业务后端职责」。passport-openidconnect：2024-02 后停更。cookie-session / 自研 JWT 无状态 cookie：无法服务端吊销，登出与权限撤销只能等过期。第一阶段接 OIDC：无现成 IdP，联调需自建 IdP 服务，成本前置无收益；provider 端口保证推迟不亏（届时新增 provider 实现 + `ExternalIdentity` 迁移 + JIT 建档 + 身份合并策略，会话与权限体系不动）。cookie 名 `cip_sid`：用户指定 `sid`。

## 后果

`infra/redis` 适配器必须先于 auth 模块落地（衔接 architecture 基础设施适配器规则）。本地登录体系自带密码生命周期（哈希选型、强度策略、后续找回流程）为新增维护面。OIDC 接入时需补充身份合并策略（同邮箱先本地注册后外部登录是否同一人）并追加 ADR。web 侧登录页按启用的 provider 渲染，本阶段只有账密表单与注册入口。
