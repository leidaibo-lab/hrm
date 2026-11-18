# Agent Guide

> 层：规范 · 时态：约束未来 · 失效：阶段迁移或治理决定变更时

> 项目：pnpm + turborepo monorepo（`apps/api` NestJS、`apps/web` Next.js、`packages/shared`）。当前仓库事实（阶段、模块、命令状态）见 `docs/index.md`——每次任务先核对，防止引用过期状态。

## 读取顺序

1. 本文件。
2. `docs/index.md`（文件地图与场景路由）。
3. 按任务取 1–2 篇：后端结构 `architecture`、编码 `code-quality`、契约 `contracts`、建表 `database`、数据 `persistence`、安全 `security`、运行 `runtime`、权限 `authorization`、命名 `naming`、前端 `frontend`、视觉 `web-ui`、表单 `forms`、测试 `testing`、注释 `code-comments`、文档与提交 `documentation`；流程与验证用 `workflow`、`boundaries`、`verification`。

一次任务默认最多读 5 篇（入口两篇不计）；新建带权限模块最多 8 篇。篇数口径以 `docs/governance.md`「规模预算」为准。不要预读整个 `docs/`。

## 硬约束

细则见 `docs/process/boundaries.md`，此处只列不可协商项：

- 不编造命令、版本、路径、测试结果；四类信息必须现场确认。
- 未执行即未验证；不得把应该能通过表述为验证结果。
- 规范约束实现，事实如实记录；实现违规先修代码，规范变更须先确认（见 `docs/governance.md`）。
- 范围外不动；删除与历史操作必须有当次明确指令。
- 不绕过检查（放宽断言、删测试、改 lint 配置）。
- 改文档结构、流程、权限规则属 L3：先给方案并取得确认。

## 任务分级

按 `docs/process/workflow.md` 判定，取最高符合项；L3 先方案确认 + 回滚路径。

## 收口要求

三项缺一不可：改了什么（路径 + 关键改动）/ 验证了什么（真实命令与关键输出）/ 没验证什么与遗留风险。收口前 `git status --short` 自查。详见 `workflow.md`「退出条件」。

## 命令与规则入口

- 命令唯一来源：`docs/reference/verification.md`
- 每个逻辑批次完成后执行变更验证；反馈循环与失败处理见 `docs/process/workflow.md`。
- 文档检查入口：`pnpm check:docs`（结构、引用、命令存在性）；规则落点检查：`pnpm check:rules`
- 权限与红线：`docs/process/boundaries.md`
- 文档治理与拆分判据：`docs/governance.md`
- PRD 规范与模板：`docs/conventions/documentation.md`「PRD 产物规范」与 `docs/prd/_TEMPLATE.md`；PRD 写设计与验收，实施进度不进 docs。
- 当前架构总览：`docs/reference/architecture-overview.md`
- 历史取舍：`docs/decisions/`（ADR，一条决定一个文件）
- 模块实施与任务收口：见 `docs/process/workflow.md`；规范与流程均以 `docs/` 为唯一来源。

## 语言

中文输出。路径、命令、代码保留原文。
