# ADR-0006 web 组件基座与布局：shadcn + AI Elements

> 状态：已接受 · 日期：2026-10-31 · 级别：L3

> 后续：视觉令牌与设计语言由 ADR-0031 修订；本 ADR 的 shadcn + AI Elements 组件基座决定继续有效。

## 决定

`apps/web` 以 shadcn（CLI 4，radix 原语、nova preset、neutral 基色）为唯一组件基座，全量落入 `components/ui/`（63 个）；AI 组件走 shadcn CLI 命名空间 `@ai-elements/*` 全量落入 `components/ai-elements/`（49 个），成为 `ai`（AI SDK）直接依赖方；主应用布局复用 block `sidebar-07`（`collapsible="icon"`，图标栏 + 二级面板形态），两级导航收敛于 `lib/navigation.ts` 注册表（条目带权限点，RSC 依会话过滤后下发），会话经 `lib/session.ts` 单一接缝（占位实现，auth 模块落地后仅替换该文件）。文件/目录一律 kebab-case；`app/` 只做路由与布局，业务进 `features/`。

## 被否决的选项

Ant Design 5（与 Tailwind 4 体系冲突、运行时黑盒）；独立 `ai-elements` CLI（官方公告 2026-11 底弃用）；主应用沿用传统侧栏后台布局（与协同产品形态和 M3 导航规范相悖）。

## 后果

`components/ui`、`components/ai-elements`、`lib/highlighter.tsx` 属生成/上游代码，受 Biome 管辖但以文件级 `biome-ignore-all` 标注 12 处不可改写的上游 a11y/渲染模式（行级压制对属性级诊断无效，实测确认）；registry 代码面向比 stable 更新的 `ai` SDK（`LanguageModelUsage.reasoningTokens` 等字段未发布），`context.tsx`/`agent.tsx` 已做 3 处稳定版适配并注释回退条件；`(auth)`、`(admin)` 路由组与 admin 权限校验待真实消费方（auth 模块）落地；AI SDK 流式链路（SSE）本轮无后端消费方，未验证。
