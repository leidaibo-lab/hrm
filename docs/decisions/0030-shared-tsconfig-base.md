# ADR-0030 抽离共享 tsconfig.base.json

> 状态：已接受 · 日期：2026-11-09 · 级别：L3

## 决定

用户新增根级 tsconfig.base.json，存放全部 TypeScript 工程的公共编译项（target ES2022、module/moduleResolution nodenext、strict、esModuleInterop、skipLibCheck、forceConsistentCasingInFileNames）。根 tsconfig.json、apps/api、apps/web、packages/shared 改为 extends 该 base，各自只保留运行时差异项：

- 根：noEmit、types: ["node"]，仅检查 scripts/。
- api：outDir、装饰器两项、sourceMap、types: ["node"]；ci/build 子配置经继承链自动生效，不直接改。
- shared：declaration、outDir、rootDir。
- web：保留 target ES2017、esnext/bundler、lib、jsx 等 Next 差异项并显式覆盖 base 的 nodenext 栈；strict、skipLibCheck、esModuleInterop 改为继承。

base 不放 exclude：extends 继承的相对路径按 base 所在目录解析，对子包指向错误位置；node_modules 本就默认排除。本决定推翻 ADR-0028「本次不建立继承关系」的范围限制，0028 其余内容（根 ESM 工程脚本、tsc -p tsconfig.json 验证入口）继续有效。受保护 tsconfig 基线随本次一并更新。

## 被否决的选项

- 把 types: ["node"] 上收进 base：web 与 shared 现状均未限制 types，上收会改变它们的全局类型收录行为。
- 在 base 放公共 exclude：继承配置的相对路径以 base 目录解析，对子包语义错误；node_modules 默认即排除。
- 只让 api 与 shared 接入、web 保持独立：抽离目的即共享严格性基线，web 覆盖模块解析后继承 strict 项无冲突。

## 后果与回滚

验证入口不变：根脚本仍走 pnpm exec tsc -p tsconfig.json，各包仍走各自 typecheck。本次触及保护基线中的根 tsconfig.json、apps/api/tsconfig.json、apps/web/tsconfig.json，基线更新以本 ADR 为治理依据。回滚需同时恢复四个 tsconfig 与 protected-files.json，并删除 tsconfig.base.json 与本文件，保持配置与基线一致。
