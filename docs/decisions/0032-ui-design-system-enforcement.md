# ADR-0032 UI 设计系统规范拆分与机检

> 状态：已接受 · 日期：2026-11-10 · 级别：L3

## 决定

把 ADR-0031 落地的设计系统从「实现 + 单篇描述」升级为「规范 + 机检」：

1. **拆分规范**：`docs/conventions/web-ui.md` 只承载设计语言与页面级契约；新增 `docs/conventions/web-ui-components.md` 承载组件尺寸/状态/焦点/浮层/图标/动效契约。现行文档预算由 18 篇调整为 19 篇；`reference/` 行数上限由 150 调整为 160（规则映射新增 13 行）。
2. **规则 ID**：新增 `UI-6.1`~`UI-6.6`（零阴影、字号令牌、内部标识、壳层/响应式、表格交互、文案/假控件）与 `UIC-7.1`~`UIC-7.7`（尺寸密度、状态色、浮层、图标、动效、vendor 补丁、焦点/边界对比度），并登记 `docs/reference/verification.md`。
3. **机检**：`scripts/checks/rules.ts` 增加硬失败项——业务代码 hex、内容区 `shadow-*`、离阶字号；并解析 `globals.css` 的浅/暗令牌，对正文/控件边界/焦点/图表做 WCAG 对比度校验。人工规则保留 review 落点。
4. **基线**：同步更新 `scripts/checks/protected-files.json`（`docs.ts` / `rules.ts`）。

## 被否决的选项

- 继续把组件契约塞进 `web-ui.md`：剩余行数不足以表达 7 类组件，且规则小节会超过 7 个。
- 组件契约放 `reference/`：reference 是当前事实层，不应承载规范。
- 只加人工 review、不加机检：零阴影/字号/hex 都是可判定的，靠 review 无法阻止回退。
- 新增独立 `check:contrast` 命令：对比度计算并入 `check:rules`，避免再增加一个必须登记的命令与保护脚本。

## 后果与回滚

- 现行文档从 18 篇变为 19 篇；`docs/governance.md`、`scripts/checks/docs.ts`、`docs/index.md` 同步更新。
- 新增规则 ID 后，`check:rules` 的 ID 双向校验覆盖全部 UI 规则；未登记或未落地的规则会失败。
- 业务代码若新增 hex、内容阴影、离阶字号或对比度不足的 token，提交门禁直接失败。
- 回滚路径：恢复 `web-ui.md`、删除 `web-ui-components.md`、恢复 governance/docs.ts/index.md 与 `verification.md` 映射、回退 `rules.ts` 与 protected 基线，并撤销本 ADR。
