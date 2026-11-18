# ADR-0077 PRD 总体设计篇定名 design 并承载完整技术设计

> 状态：已接受 · 日期：2026-11-17 · 级别：L3

## 决定

目录式 PRD 固定为 **`index.md`（门户）/ `design.md`（总体设计）/ `NN-<域>.md`（业务域规格）** 三类文档。原 `architecture.md` 更名为 `design.md`，原 `01-ingress.md` 更名为 `01-source.md`。

`design.md` 承载完整设计，固定 12 节：总体架构与 Super-agent 运行模型、领域模型、端到端数据流、技术方案、文件结构与模块职责、数据模型、接口与契约、扩展与接入、部署与运维、设计边界与风险、变更记录。架构、技术方案、文件结构、数据与接口只在 `design.md` 写一次；业务域篇只写本域增量与验收。

agentic 采用**单模块**结构：`domain/`（领域核心 Engine）、`application/`（engine/runtime/passes/outbox/notices/setup）、`infrastructure/`（persistence/effects/sources/executor/channels）。取消独立 `connector` 模块，Lark 并入 `infrastructure/sources/lark/`；执行层拆为 `agents/`（AgentSpec 定义）、`session/`（运行实例管理，单数与 workspace 同级）、`workspace/`（执行环境）；Source 契约与 AgentSpec 作为所有业务系统与业务能力的接入方式。PRD 描述目标态，不为既有实现做兼容。

机器检查同步：`scripts/checks/docs.ts` 的模板映射改为 `design.md`，`apps/api/src/__tests__/prd-consistency.spec.ts` 引用同步；检查设施保护基线随本 ADR 更新。

本 ADR 取代 ADR-0076。

## 被否决的选项

- **保留 `architecture.md` 名称**：内容已超出“架构”，还包含技术方案、文件结构、数据模型、接口与难点，名称与职责不符。
- **拆出 `tech-solution.md` / `implementation.md`**：同一事实在架构、方案、实现三处重复，形成第二事实源。
- **保留独立 `connector` 模块**：与官方 Super-agent 的 Source 插件模型冲突，会产生第二套接入抽象。
- **兼容既有实现（保留旧目录/旧命名）**：PRD 是目标设计来源，兼容现状会把实现债写进设计。

## 后果与回滚

- PRD 8 篇改名/重写；旧 `architecture.md`、`01-ingress.md` 内容并入新篇；删除旧专题篇（git 历史保留）。
- 检查设施（`docs.ts`、`prd-consistency.spec.ts`）与保护基线同批更新。
- 回滚：revert 本批提交，恢复旧文件名、旧模板映射与保护基线，并恢复 ADR-0076 状态。
