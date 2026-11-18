# 视觉与交互规范（apps/web）

> 层：规范 · 时态：约束未来 · 失效：设计语言或治理决定变更时

## 目的

承载设计语言与页面级契约：令牌、排版、层级、壳层、表格、响应式。组件级尺寸/状态/焦点/图标/动效见 `web-ui-components.md`；结构分层见 `frontend.md`，表单见 `forms.md`，取舍见 `../decisions/0033-web-palette-stock-zinc.md`、`../decisions/0034-web-sidebar-block-07.md` 与 `../decisions/0032-ui-design-system-enforcement.md`（ADR-0031 的层级/字阶/布局骨架仍有效，配色与侧栏导航交互分别被 0033/0034 修订）。

## 何时读取

- 新增或修改页面、主题、壳层、表格交互时。
- 新增或修改组件时，同时读 `web-ui-components.md`。

## 适用范围与不适用

- 适用：`apps/web` 业务源码与 `app/globals.css`。
- `components/ui/`、`components/ai-elements/` 以上游为基座；只允许按 `web-ui-components.md` 做 token 补丁，补丁必须可回退。

## 设计原则

1. **中性承重**：界面主体为 zinc 冷中性灰阶；主色即中性墨色（浅 zinc-900 / 暗 zinc-200），无独立品牌色。
2. **一个亮点**：每屏只有一个视觉重心（一张图、一个数字、一次主操作），其余保持安静。
3. **内容零阴影**：内容区只用 1px hairline 与 surface 阶梯；阴影只属于浮层。
4. **边界可感知**：装饰分隔用 hairline；控件边界与焦点必须 ≥3:1。
5. **内容即页面**：表格/列表零容器平铺；层级来自字号、留白与发丝线，不靠卡片堆叠。

## 设计令牌

1. 双主题令牌唯一来源是 `app/globals.css` 的 `:root` 与 `.dark`；组件只引用 token，禁止硬编码色值。 `UI-5.1`
2. 主题经 `next-themes`（class 模式）切换，暗色为必选交付。
3. 新增或修改令牌必须先改 `globals.css`，再同步本节表格；本节只登记语义名与取值，不复制 CSS 实现。
4. 十六进制色值禁止出现在业务组件的 `className` / `style` 中；`app/globals.css` 与 vendor 目录豁免；`check:rules` 对命中直接失败。 `UI-5.2`

| 令牌                                     | 浅色                                              | 暗色                                              |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| canvas / surface / surface-2 / surface-3 | `#FFFFFF` / `#FFFFFF` / `#F4F4F5`（二三档同值）   | `#09090B` / `#18181B` / `#27272A`（二三档同值）   |
| foreground 三档                          | `#09090B` / `#71717A` / `#A1A1AA`                 | `#FAFAFA` / `#A1A1AA` / `#71717A`                 |
| border / control-border                  | `#E4E4E7` / `#71717A`                             | `rgba(255,255,255,.10)` / `#71717A`               |
| primary / hover / tint（=选中底）        | `#18181B` / `#27272A` / `#F4F4F5`                 | `#E4E4E7` / `#D4D4D8` / `#27272A`                 |
| success / warning / danger               | `#16824D` / `#985E00` / `#DC2626`                 | `#4CC38A` / `#E0A64A` / `#FF6467`                 |
| chart-1..5                               | `#8E51FF` `#7F22FE` `#7008E7` `#5D0EC0` `#4A1897` | `#C4B4FF` `#B398FF` `#A174FF` `#9256FF` `#8335FF` |
| sidebar / sidebar-accent                 | `#FAFAFA` / `#F4F4F5`                             | `#18181B` / `#27272A`                             |
| radius / overlay shadow / motion         | 5·7·9·12·16 / `--shadow-overlay` / 140·200·320ms  | 同左                                              |

主色即中性墨色（无品牌色相）；图表五档沿用 zinc 主题自带的紫罗兰色系，仅用于数据可视化。语义色只做状态点/文字/浅底，不做整块填充。暗色侧栏的 `sidebar-primary` 为 zinc 主题官方自带的 indigo 点缀（`#1447E6`）。

## 排版与密度

- 字体：Inter（Latin，next/font）+ 系统中文栈；mono `ui-monospace`；标题与正文同一家族，靠字号与颜色分层。
- 字阶：12（辅助）/ 13（次级）/ 14（正文·表头）/ 16（分区）/ 24（页面标题）/ 30（展示）；卡片数字 27 `tabular-nums`。业务代码只允许 `text-[length:var(--text-*) ]`，禁止 `text-[13px]` / `text-[0.8rem]` 等离阶值。 `UI-6.2`
- 字重 400/500/600；中文正文零字距；仅 Latin 展示字可 -0.02em。
- 间距 4px 基数：页面左右 28、区块 24–32、卡片内 16；控件/表格尺寸见 `web-ui-components.md`。
- 动效：140ms 反馈 / 200ms 浮层 / 320ms 入场，`cubic-bezier(0.22,1,0.36,1)`；只动 transform/opacity/color；禁止无限循环装饰动画；尊重 `prefers-reduced-motion`。

## 层级与表面

| 层      | z-index | 成员                                 | 规则                                  |
| ------- | ------- | ------------------------------------ | ------------------------------------- |
| z0 内容 | 0       | 表格、表单、卡片、统计带             | 零容器、零阴影；层级靠字号与 hairline |
| z1 粘滞 | 10      | 顶栏、sticky 表头                    | 仅 hairline 分隔                      |
| z2 浮层 | 30      | popover、dropdown、tooltip、命令面板 | `--shadow-overlay`                    |
| z3 模态 | 40      | dialog、drawer                       | `--shadow-overlay` + scrim            |

内容区禁止 `shadow-*`；`check:rules` 只允许命令面板与筛选浮层的浮层容器使用阴影。 `UI-6.1`

## 壳层与响应式

- 侧栏 248（rail 56）：品牌行 + 命令入口（⌘K）+ 分组导航 + 底部用户菜单；导航为 sidebar-07 block 模式——无子项域为一级项（34），有子项域为可折叠组（默认展开含 active 的组，二级 28）；active = `sidebar-accent`，icon rail 收 32 方位 + 右侧 tooltip（取舍见 ADR-0034）。
- 顶栏 52：折叠钮 + 面包屑 + 主题切换；全局搜索统一进侧栏命令入口与 `⌘K`。
- 页面骨架 `Page`：Header 24/600 + 13 描述 + 主操作；Content default 28 / flush / constrained 760；Footer 钉底。
- 内容宽度：列表最大 1360；表单 760；详情 960；禁止无上限。
- 响应式：≥1280 全列、侧栏展开 ▸ 1024~1279 icon rail 56 ▸ 768~1023 抽屉 + 横向滚动 ▸ <768 行卡片化。 `UI-6.4`

## 表格与交互

TableView 的产品交互和公共 API 唯一功能规格见 `../prd/table-view.md`。该规格定义 toolbar、六种筛选操作符、排序、列设置 Drawer、选择、checkbox overlay、sticky header/footer、空态、回调和查询状态；本节不复制功能细节。

全局视觉规则仍适用：内容平铺无卡片堆叠；sticky header 属于 z1；drawer 属于模态层；状态色来自语义令牌；键盘焦点和触屏可操作性符合本规范。

## 文案与交互契约

- 界面不出现路由路径、UUID、权限码、ADR 编号、开发 roadmap；技术标识退到复制按钮或「高级」之后；权限点目录管理页豁免（页主题即权限码目录，展示 code 是产品功能本身）。 `UI-6.3`
- `⌘K` 命令面板负责全局找目标；表格搜索只收窄当前表格视图，必须由查询接口消费 `q`。 `UI-6.5`
- 控件必须有真实行为：搜索必须消费 `q`，分页大小必须生效，菜单项必须有路由/行为；未实现前不渲染。明示未实现且具备真实无障碍反馈的占位控件（`aria-disabled` + 触发结果提示）允许渲染。 `UI-6.6`
- 空态给下一步动作；错误态给 retry；加载态用 skeleton，不用纯文本「加载中…」。

## 验证方式

- `UI-5.2` / `UI-6.1` / `UI-6.2` 由 `pnpm check:rules` 硬失败；hex 候选、内部标识候选同脚本输出。
- `UI-5.1`、`UI-6.3`~`UI-6.6` 由代码 review + 浏览器截图；对比度由 `check:rules` 的 token 对比度检查覆盖。
- 视觉与交互以代码 review + 设计对照为准；`prefers-reduced-motion` 用 DevTools 渲染模拟验证。
