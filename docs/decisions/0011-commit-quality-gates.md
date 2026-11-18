# ADR-0011 提交质量门禁（husky + commitlint + lint-staged）

> 状态：已接受 · 日期：2026-11-01 · 级别：L3

## 决定

引入 husky（hook 运行器）+ @commitlint/cli + lint-staged：commit-msg 强制 documentation.md「提交信息」规则中机器可判定项（type/scope 枚举、header ≤100、句号结尾、type/subject 非空）；pre-commit 经 lint-staged 对暂存文件执行 biome 安全修复。commitlint 规则与 documentation.md 同源（根 package.json 的 `commitlint` 字段，不用 config-conventional 预设）；hook 经根 `prepare` 脚本自动启用（husky 设置 core.hooksPath）。

## 被否决的选项

维持「人工 review 抽查」：规范执行点在收口之后，违规已落历史，无法在提交时拦截。commitlint config-conventional 预设：其规则与本项目中文主题、自定义 scope 集不合，改为本地 rules 与规范单源。pre-commit 全仓 biome check：提交耗时随仓库线性恶化，全仓兜底已由 `pnpm lint` 与 CI 承担，pre-commit 只查暂存。

## 后果

documentation.md「提交信息」规则 7 中「不引入 commitlint 等新工具」条款由本 ADR 修订；本机 clone 后 `pnpm install` 自动启用 hook；语义质量（为什么、可读性）无法机器判定，仍由 review 承接。
