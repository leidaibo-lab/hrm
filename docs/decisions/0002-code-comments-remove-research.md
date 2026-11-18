# ADR-0002 新增代码注释规范、移除 research 归档

> 状态：已接受 · 日期：2026-10-31 · 级别：L3

## 决定

新增 `docs/conventions/code-comments.md`（JSDoc；TS 签名已表达类型，JSDoc 不重复 `{类型}`）；现行文档预算 8 → 9 篇；删除 `docs/research/` 两篇归档，历史依据只保留决策记录；目录层数由三层（规范 / 描述 / 解释）改为两层（规范 / 描述）；结构检查预期值与 `docs/index.md` 计数同步改为 9。

## 被否决的选项

保留 research 归档（不占预算，但增加路由面；其版本号是从空 `.pnpm` 目录推断，易被后续任务误当事实）；把注释规范并入 `documentation.md`（混合文档与代码两类产物，且该文件已声明代码注释不在其内）；等 lint 落地再写规范（阶段 0 无工具载体，用户当前即需要）。

## 后果

`AGENTS.md`、`docs/index.md`、`docs/reference/context.md` 不再引用 research；`workflow.md` 与 `verification.md` 把注释的"契约要求"与"格式细节"分开；按用户要求，代码注释规范不设「验证方式」，注释正文禁止引用本地文档；删除的归档无法从 git 恢复：执行时仓库已无提交历史（`.git` 于 2026-10-31 04:51 被重建）。
