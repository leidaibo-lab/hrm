# ADR-0075 运维脚本环境变量登记

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

在 `turbo.json` 的 `globalPassThroughEnv` 登记 agentic 运维脚本使用的环境变量：

- `AGENTIC_BASE_URL`、`AGENTIC_ATTENTION_ID`
- `AGENTIC_LOAD_*`（URL、并发、请求数、令牌、SLO 阈值、决策）
- `INTERNAL_API_TOKEN`

这些脚本经 `pnpm exec tsx` 手动执行，不走 Turbo 任务缓存；登记为 pass-through 只为满足静态检查并为未来任务化保留正确语义，不改变脚本行为。

## 被否决的选项

- **逐个文件加 `biome-ignore`**：隐藏警告，新增脚本仍会重复出现。
- **登记为 `globalEnv`**：会让这些运维参数参与任务哈希，明明不影响构建却导致缓存失效。
- **把变量塞进 `build`/`test` 任务**：脚本不属于这些任务，语义错误。

## 验证

2026-11-16：`pnpm lint` 从 14 warnings 降为 0 warnings；`turbo.json` 通过 Biome/JSON 解析；`pnpm typecheck`、`pnpm check:docs`、`pnpm check:protected`（基线更新）通过。

## 后果

- 新增运维环境变量时需同步本清单与 ADR，否则 warning 会再次出现。
- 这些变量不会进入任务哈希；若未来把脚本纳入 Turbo 任务，应改为任务级 `env`。
