# ADR-0079 PRD 按限界上下文拆分与 v3 模板校验扩展

> 状态：已接受 · 日期：2026-11-17 · 级别：L3

## 决定

PRD 按**限界上下文**拆分目录，而不是把所有平台能力塞进单一产品 PRD：

- `docs/prd/agentic/`：任务托管内核（Engine、Scheduler、Runtime、Source、Ticket、Gate、Artifact、Console）；
- `docs/prd/model-gateway/`：模型网关（provider、逻辑模型与候选、路由与失败转移、限流、计量与成本）；
- `docs/prd/iam/`：身份与访问（用户、角色、权限点、Space 与成员、资源授权、能力令牌）。

三个目录统一使用 PRD 规范 v3（ADR-0076/0077 的 index/design/NN-域 结构与 A/B 段），
`scripts/checks/docs.ts` 的模板校验从“仅 agentic”扩展为目录清单驱动；其它目录继续按旧模板校验，直至迁移完成。

检查设施变更同步更新保护基线，治理依据为本 ADR；同批把 `prd-consistency` 的表清单对齐目标前缀（agentic_ / iam_ / model_gateway_ / audit_）。

## 被否决的选项

- **把模型网关与身份访问写成 agentic 的功能篇**：它们是独立限界上下文与独立模块，挂在 agentic 下会让边界与归属失真。
- **新建目录继续用旧模板**：与 ADR-0076/0077 的目标态冲突，且无法用机检约束 A/B 结构与验收格式。
- **只改文档不改检查设施**：目录拆分后模板校验失效，等于放弃机检。

## 后果与回滚

- `docs/checks` 的 PRD 校验改为目录清单；新增 v3 PRD 目录需在该清单登记。
- `docs/index.md` 必须列出每个 PRD 目录的 index.md。
- 回滚：revert 本批提交，恢复仅 agentic 的硬编码校验与保护基线，PRD 目录合并回单一产品。
