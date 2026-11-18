# ADR-0029 PRD 目录与文档三层模型

> 状态：已取代 · 日期：2026-11-09 · 级别：L3

## 决定

新增 `docs/prd/` 作为计划层，存放澄清后的产品需求文档（PRD）：治理模型由规范/描述两层扩为三层，`prd/` 比照 `decisions/` 豁免（不计 18 篇预算、不设行数上限、不要求三元组）。每个 PRD 必须遵循 `docs/prd/_TEMPLATE.md` 的 15 节标准结构，命名只允许单次型 `YYYYMMDD-<英文短名>.md` 与演进型 `<英文短名>.md` 两类（DOC-3.2、DOC-3.3）；文件命名与模板章节完整性由 `pnpm check:docs` 机检。规则正文落在 `documentation.md`「PRD 产物规范」，路由登记 `index.md` 与 `verification.md`，检查实现在 `scripts/checks/docs.ts` 并更新保护基线（decision 0029）。

## 被否决的选项

- 根目录独立 `PRD/`：文档入口分裂，agent 读取顺序无法自然覆盖。
- PRD 计入现行文档预算并设行数上限：需求文档篇幅随功能复杂度变化，行数上限会截断验收标准；用户明确否决行数限制。
- 持续迭代每轮新建 PRD 文件：当前真相散落多份，agent 需拼接多文档还原现状，违背单一事实来源。
- PRD 放 GitLab issue 或本地 gitignored 目录：前者是流程对象不是文档载体，后者无法共享与版本化。
- 模板保留「评审人」字段与「评审中」状态：单人工作流无评审环节，字段空置；状态改为「澄清中」。

## 后果与回滚

`documentation.md`「适用」条款与反模式表同步收窄：未来需求只允许出现在 `prd/` 层。演进型 PRD 依赖版本记录与 ADR 分工（PRD 管 what 与验收，ADR 管 why）；「已确认」状态只能由作者设置，agent 不得代行。回滚时删除 `prd/` 目录、还原 governance/documentation/index/verification 四处条款、删除本 ADR 并更新保护基线，机检随 docs.ts 还原。
