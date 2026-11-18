# ADR-0004 接口返回值契约

> 状态：已取代（ADR-0055） · 日期：2026-10-31 · 级别：L3

## 决定

成功响应返回裸载荷 + 正确 HTTP 状态码，禁止信封；失败响应遵循 RFC 9457 Problem Details（`application/problem+json`），标准成员 `type`/`title`/`status`/`detail`/`instance`，扩展成员 `code`（字符串业务错误码，域前缀分节）、`traceId`、字段级 `errors[]`；机器判断只依赖 `code`。子约定：列表 `{ items, nextCursor }`（offset 可附 `total`）；可空字段显式 `null`；时间 ISO 8601 UTC 字符串；ID 字符串；JSON camelCase；响应 DTO 以 zod schema 出站 `parse()` 兼做白名单剥离。

## 被否决的选项

统一信封 `{ code, message, data }`（架空 HTTP 语义，codegen 业务类型被包裹）；混合式统一错误体（用户选定 RFC 9457 标准格式）；数字错误码（需分配表管理、可读性差）。

## 后果

错误契约随 OpenAPI 进入生成 client，前端全局错误拦截按 `code` 窄化；`type` 默认 `about:blank`，需要文档跳转的错误再补语义 URI；错误码表登记 `packages/shared` 作为 TS union。
