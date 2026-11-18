# ADR-0028 根 TypeScript 配置与 ESM 工程脚本

> 状态：已接受 · 日期：2026-11-08 · 级别：L3

## 决定

用户要求根目录 tsconfig.json 替代 tsconfig.scripts.json，保留用户已设置的根 package.json type=module。工程脚本使用根配置严格检查，经 tsx 执行，路径与 CLI 入口判断采用 import.meta.url。删除旧配置引用并更新命令及保护基线。

API、Web 和 shared 继续使用各自 package.json 与 tsconfig 的作用域，本次不建立继承关系，也不切换 API 的默认 CommonJS 模式。根配置只检查 scripts 下 TypeScript，不把 Next 和 Nest 配置混为一套。

## 被否决的选项

- 同时保留 tsconfig.scripts.json：与直接替代要求不符。
- 根已声明 ESM 后保留 __dirname/__filename：ESM 运行时没有这两个 CommonJS 全局。
- 顺带让所有应用继承根配置：不同运行环境有独立类型和解析要求，不属于此次替代范围。

## 后果与回滚

根配置检查直接执行 pnpm exec tsc -p tsconfig.json，不保留额外的 typecheck:scripts 命令别名。根配置、模块声明、脚本入口和保护基线需要一起审查；回滚同样必须保持这些内容一致，不改业务写入或 CI 无构建无数据库约定。
