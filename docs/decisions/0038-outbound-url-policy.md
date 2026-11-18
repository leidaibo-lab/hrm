# 供应商出站地址策略与上游调用运行保障

> 状态：已接受 · 日期：2026-11-15 · 级别：L3

## 背景

供应商 `baseUrl` 为管理员可配置的出站目标（`model-provider:manage`），此前仅经 `z.url()` 格式校验即用于连通性探测与模型网关，属 security「信任边界 2」缺口；网关上游调用在 `timeoutMs` 未配置时不设限且覆盖调用方 abort 信号，属 runtime「外部调用与资源」缺口。全量审查（2026-11-15）定为优先治理项。

## 决定

出站策略（ADR-0015 信任边界补登记）：`baseUrl` 及其重定向每一跳必须满足——协议仅 `https:`/`http:`、无内嵌凭据、目标主机不在环回/私网/CGNAT/链路本地等保留网段且非内网主机名后缀（`.internal`/`.local`/`.lan`/`.home.arpa`/`.corp`）。策略在 `platform/http`（探测、目录拉取）与网关模型解析两处强制执行。本地供应商（如 ollama）联调经 `OUTBOUND_ALLOW_PRIVATE_HOSTS` 显式注入精确主机豁免，默认空 = 全部阻断，禁止静默放宽。

上游调用保障：网关 fetch 的执行超时不可缺省——未配置 `timeoutMs` 时以 30s 兜底；超时信号与调用方 abort 经 `AbortSignal.any` 合并，取消可传播到上游。`HttpService` 改手动跟跳（≤3 跳）并对每一跳重跑策略，防重定向绕过。

被否决的选项：仅凭 `model-provider:manage` 角色信任 baseUrl（规范要求的是明确策略而非仅信任角色）；全局放行私网（本地联调应走显式豁免清单）；继续允许 `timeoutMs=null` 无限挂起。

## 后果

探测错误体回显（截断 300 字符）保留为诊断能力，但内网目标已被策略阻断，探测通道不再可作为内网探测放大器。残余风险按缓解次序登记：① DNS 解析未纳入校验，存在重绑定 TOCTOU 窗口，后续以 undici 自定义 connect 钩子在拨号期复核；② AI SDK/undici 内部自动跟跳不经本策略，公网供应商 302 到内网的窗口由出站方网络策略（部署环境出口限制）兜底；③ 豁免清单为主机名精确匹配，不含通配。生产环境新增安全断言：`COOKIE_SECURE` 未显式置 true、`AUTH_ALLOWED_ORIGINS` 未显式注入时 fail-fast（补齐 runtime「区分环境」要求）。回滚为移除策略调用点与 `OUTBOUND_ALLOW_PRIVATE_HOSTS` 键、恢复 `timeoutFetch` 旧行为，均不影响数据。
