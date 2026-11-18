# ADR-0031 Web 设计语言：Ink & Signal + Violet 品牌种子

> 状态：已接受（品牌色与中性配色被 0033 取代；侧栏分组导航交互被 0034 修订；层级/字阶/布局骨架仍有效） · 日期：2026-11-09 · 级别：L3

## 决定

`apps/web` 采用「Ink & Signal（墨与信号）」设计语言，替换 ADR-0006 时期的 Twenty Jade 主题默认值：

- **品牌色**：Logo 紫点作为品牌种子，浅色 `#4F3AC4`、暗色 `#B7A2FF`；品牌色只承担主操作、选中、焦点、链接与一个关键数据，面积 <5%。
- **中性**：暖纸画布 `#FAF9F6` + 白 surface + 石墨文字；暗色暖黑 `#0E0E0D` 起阶梯。
- **层级**：内容区只用 1px hairline + surface 阶梯；`--shadow-overlay` 只给 command palette / dialog / popover / dropdown。z0 内容零容器、零阴影。
- **字阶**：12 / 13 / 14 / 16 / 24 / 30（表头/辅助 12、次级 13、正文 14、分区 16、页面标题 24、展示 30；卡片数字 27 tabular）；字重 400/500/600。
- **布局**：侧栏 248、顶栏 52、内容左右 28、最大宽 1360；表单 760；表格满幅。
- **表格**：继续使用 `components/table-view`（TableView + useTableViewState + TanStack），不改数据层/URL 状态/列定义/批量/筛选 API；表头 36、行 48（双行 56）、选中 2px 左侧品牌指示。
- **组件策略**：`components/ui` 仍以上游为基座，但允许按本 ADR 做「token 化 + 尺寸/密度」的最小补丁（button/input/badge/dialog/select/checkbox/switch/textarea/field/sidebar），补丁需在文件内注释回退条件；禁止在业务代码写 hex。

## 被否决的选项

- 保留 Twenty Jade `#268058`：用户明确「现有主题色不是品牌色」；绿还是成功色，语义冲突。
- 中性 + 蓝点（仅墨主色）：品牌纯度最高，但内部评审对「没有品牌色」的接受度不确定；作为备选保留。
- 蓝/藏蓝主色：企业安全，但与飞书/钉钉/企微同质化。
- 保留认证页渐变/aurora/星网/流光：2023 式 AI 模板，暗色对比 1.97–2.65，且动画未运行时表单不可见。
- 内容区使用阴影：与 z0 零容器原则冲突，实测会形成「卡片套卡片」的层级噪音。
- 替换 TableView 为新的表格实现：现有能力（facets/views/批量/列宽持久化/URL 状态）成熟，重写成本与回归风险不成比例。

## 后果与回滚

- `apps/web/app/globals.css` 成为唯一令牌源；`components/ui` 的补丁需在升级上游时复核（记录于本 ADR，回退即恢复上游文件）。
- `docs/conventions/web-ui.md` 的令牌表、字阶、层级、表格规则同步更新；`UI-5.1`/`UI-5.2` 继续有效。
- 认证页删除 canvas/aurora/流光与 6 处硬编码 rgba；favicon 改为深墨紫底 + 白标 + 紫点。
- 回滚路径：恢复 `globals.css`、`components/ui` 相关文件、`logo.tsx`/`icon.svg`、`web-ui.md`，并撤销本 ADR。
