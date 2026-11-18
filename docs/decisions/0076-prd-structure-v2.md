# ADR-0076 PRD 规范 v2：三类文档与职责分离

> 状态：已取代 · 日期：2026-11-17 · 级别：L3

## 决定

`docs/prd/` 的目录式 PRD 统一为**三类文档**，不再按技术分层拆专题：

- `index.md`：门户与产品定稿（定位、用户、范围、功能全景、一页架构、非功能与指标、验收总览、阅读路径与文档索引）。
- `architecture.md`：架构与实现总览（Super-agent 总体设计、领域模型、数据流转与时序、业务边界与权限、技术架构、数据模型总览、接口总览、模块与文件地图、扩展轴、设计边界与待决项）。
- `NN-<域>.md`：功能域规格，固定「A 产品规格（A1–A7）+ B 技术设计（B1–B7）+ 验收要点」。

职责边界：PRD 写设计、实现与验收；技术取舍与被否决项写在 ADR；实施进度与完成度写在提交与 issue，不进入 PRD。PRD 内不再保留技术执行规格章节、实施状态表、backlog、迁移清单与测试矩阵。

agentic 按本规范重写为 8 篇（index、architecture、01–06），删除旧 10 篇（index/domain/data-model/runtime/context/security/web/operations/file-structure/checklist 旧版）。

机器检查同步调整：模板按文件名识别（index、architecture、`NN-域`）；产品段禁实现词、功能篇 B 段禁进度词；AC 编号全局唯一且状态限定枚举；表/接口/文件「总览归 architecture、明细归本域」。过渡期 `docs.ts` 对 agentic 启用新模板，其他目录式 PRD（connector）暂用旧模板；退出条件为 connector 迁移完成或下一次文档治理评审，二者先到者为准。

## 被否决的选项

- **保留 18 节/8 节模板**：产品设计与实现状态继续混写，无法通过评审拆清职责。
- **独立 `tech-solution.md` 与 `implementation.md`**：同一事实在架构、方案、实现三处重复，形成第二事实源。
- **PRD 只写产品、实现全部下沉到代码与 ADR**：实施者无法从 PRD 直接开工，ADR 被当成规格用。
- **继续按技术分层拆专题（domain/data-model/runtime/security/web/operations）**：读者无法按业务流评审，且与实现变化强耦合。

## 后果与回滚

- 更新 `docs/governance.md`、`docs/conventions/documentation.md`、`docs/prd/_TEMPLATE.md`、`scripts/checks/docs.ts` 与两个 PRD 一致性测试；按本 ADR 更新检查设施保护基线。
- 旧篇删除后内容在 git 历史与 `docs/decisions/` 中可追溯；不保留并行旧文档，避免双写。
- 回滚：revert 本批提交，恢复旧模板、旧 18/8 节检查与保护基线，旧文档随历史恢复。
