# ADR-0033 Web 配色：恢复 shadcn stock zinc

> 状态：已接受 · 日期：2026-11-10 · 级别：L3

## 决定

`apps/web` 恢复 shadcn 官方 zinc 主题配色（v4 oklch 原值），完全去品牌色，替换 ADR-0031 的「暖纸中性 + Violet 品牌种子」：

- **主色即中性墨色**：浅 `#18181B`（zinc-900）底 `#FAFAFA` 字、暗 `#E4E4E7`（zinc-200）底 `#18181B` 字；不再存在品牌色相。
- **令牌落地格式**：`check:rules` 的对比度机检只解析 hex（ADR-0032），全部令牌以 oklch→hex 等值转换写入 `globals.css`，落在 zinc canonical 值（`#09090B`/`#18181B`/`#27272A`/`#71717A`/`#A1A1AA`/`#E4E4E7`/`#F4F4F5`/`#FAFAFA`）。
- **门禁微调 6 处**（stock 原值过不了 WCAG 门禁，取相邻档；其余 token 逐值忠实原值）：
  - 浅 `--input`/`--ring`：stock zinc-200/zinc-400 → `#71717A`（控件边界与焦点环 ≥3:1）。
  - 暗 `--input`：stock 白 15% alpha → `#71717A`（同上；暗 `--ring` stock 原值本就是 zinc-500，非微调）。
  - 浅 `--destructive`：stock `oklch(0.577 0.245 27.325)`≈`#E7000B`（3.9:1）→ `#DC2626`（4.83:1，危险文字 ≥4.5:1）。
  - 浅 chart-1..5：stock 亮档 chart-1（1.86:1）等过不了图表 ≥3:1，ramp 降一档取 stock chart-2..5 原值 + 新增深档 `#4A1897`（4.40~11.24:1）。
  - 暗 chart-1..5：stock chart-4/5（2.73/2.17:1）过不了，ramp 升档为 `#C4B4FF`（stock chart-1 原值）+ `#B398FF`/`#A174FF`/`#9256FF`/`#8335FF`（3.71~10.72:1）。
- **沿用与清理**：`--success`/`--warning` 沿用 ADR-0031 值（stock 无 success/warning，现值过门禁）；死令牌 `--primary-deep`、`--info`、`--auth-panel-end` 删除（零消费方，已核实）；`--primary-hover`/`--tint`/`--faint` 保留并映射 zinc 档（tint=选中底=zinc-100/800）。暗色 `--sidebar-primary` 忠实保留 stock indigo 点缀 `#1447E6`。
- **结构不动**：radius 阶、阴影、字阶、间距、动效、布局、表格交互均不变（ADR-0031 相应决定与 ADR-0032 机检继续有效）；`components/ui` 与 `components/ai-elements` 全部为 token 引用，值随令牌走，无组件改动。
- **Logo/favicon 中性化**：`logo.tsx` 主色点 `fill-primary` 自动跟随；`icon.svg` 底 `#09090B` + 白标 + `#A1A1AA` 点。

## 被否决的选项

- zinc 中性 + 保留品牌紫 primary：用户明确选择「完全恢复 stock zinc」，去品牌色。
- 忠实 stock 原值 + 放宽机检（改 `rules.ts` 阈值或支持 oklch）：控件边界/焦点 ≥3:1 与正文 4.5:1 是无障碍门禁（ADR-0032），为配色取消门禁代价不成比例。
- oklch 原样写入 `globals.css`：机检正则只解析 hex，全部令牌将报「对比度令牌缺失」而失败。
- 暗 `--sidebar-primary` 中性化：stock zinc 官方自带 indigo 点缀，忠实原值优先。

## 后果与回滚

- `globals.css` 唯一令牌源不变；`web-ui.md` 令牌表与设计原则、`web-ui-components.md` 控件边框备注、`logo.tsx`/`auth-aside.tsx` 注释同步更新；ADR-0031 状态行标注配色部分被本 ADR 取代（层级/字阶/布局决定仍有效）。
- 对比度机检 14 组 × 双主题在新值下全绿（`pnpm check:rules` 0 violations）。
- 回滚路径：恢复 `apps/web/app/globals.css`、`apps/web/app/icon.svg`、`apps/web/components/logo.tsx`、`apps/web/features/auth/components/auth-aside.tsx`、`docs/conventions/web-ui.md`、`docs/conventions/web-ui-components.md`、ADR-0031 状态行，并撤销本 ADR。
