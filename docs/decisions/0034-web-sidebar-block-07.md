# ADR-0034 侧栏采用 shadcn sidebar-07 block 样式

> 状态：已接受 · 日期：2026-11-10 · 级别：L3

## 决定

`apps/web` 侧栏分组导航采用 shadcn 官方 sidebar-07 block（"A sidebar that collapses to icons"，new-york-v4 源码）的结构与交互样式，替换手写 nav（div/ul/li + 平铺组标签）：

- **导航结构**：无子项的域渲染为一级 `SidebarMenuItem + SidebarMenuButton asChild Link`（`isActive` + `tooltip`）；有子项的域渲染为 `Collapsible asChild > SidebarMenuItem` 可折叠组——默认展开含 active 的组，`ChevronRight` 随开合旋转（`group-data-[state=open]/collapsible:rotate-90`），二级项挂 `SidebarMenuSub > SidebarMenuSubButton`。
- **active 语义**：由 ui 组件内建 `data-active=sidebar-accent + font-medium` 承载，替代原「`bg-card` + hairline」样式（ADR-0031 壳层描述随之修订）；active 判定沿用精确匹配 + `startsWith(path + '/')`。
- **尺寸**：一级 34（`ui/sidebar.tsx` 既有 `h-[34px]` 补丁承载）、二级 28（上游 `h-7`，替代原 32）；`SidebarMenuSubButton` 传 `w-full` 使链接占满整行（上游为内容宽）；组容器 `SidebarGroup` 传 `px-3` 保持侧栏既有 12px 内边距节奏（品牌行/页脚一致）。
- **保留差异**（block 中无对应物，为功能需求）：`Brand` 品牌位、`SidebarCommand`（⌘K 入口，UI-6.5）、顶栏 52 + 主题切换/通知、`workspace-shell` 的 1024~1279 自动 rail / ≥1280 展开 + cookie 持久化；二级项保留图标（`NavigationNodeDto.icon` 有数据语义）。
- **落地方式**：不执行 `npx shadcn add sidebar-07` 直装——本项目 `components.json` style 为 `radix-nova`，直装会引入 demo 文件（假数据 dashboard 页、nav-projects/team-switcher）并可能覆写带补丁的 `ui/sidebar.tsx`；改为按 new-york-v4 block 源码手工落地（与 CLI 落地后改写别名所得内容一致）。

## 被否决的选项

- CLI 直装 sidebar-07：拉 demo 假数据页 + 覆写 `ui/sidebar.tsx` 三处补丁（宽 15.5rem / icon 3.5rem / 菜单钮 34px，即规范 248/56/34 的载体），得不偿失。
- 引入 `TeamSwitcher` 替换 Brand：本项目非多租户（brand.tsx 明注无切换语义），无数据支撑。
- 维持手写 nav（仅换配色类）：无法获得 block 的折叠交互/tooltip/data-active 语义，与「采用该 block」的指令相悖。
- 二级项去掉图标（严格贴 block demo）：数据含 icon 字段，去掉丢失辨识度。

## 后果与回滚

- `apps/web/components/nav-main.tsx` 重写为 block 结构；`app-sidebar.tsx` 拼装不变（原 padding 耦合随重写移除）；`docs/conventions/web-ui.md` 壳层行同步（一级 34 / 二级 28 / active=sidebar-accent）；ADR-0031 状态行追加「侧栏分组导航交互被 0034 修订」。
- 回滚路径：恢复 `nav-main.tsx`、`web-ui.md`、ADR-0031 状态行，并撤销本 ADR。
