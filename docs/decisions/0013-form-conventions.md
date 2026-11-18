# ADR-0013 表单规范独立成篇与 react-hook-form 选型

> 状态：已接受 · 日期：2026-11-01 · 级别：L3

## 决定

表单规范独立为 `docs/conventions/forms.md`，现行文档预算 13 → 14 篇；前端表单选型基座定为 react-hook-form + @hookform/resolvers（zodResolver），校验 schema 唯一来源 `@cip/shared`。必填标识经业务组件 `components/field-label.tsx`（`<FieldLabel required>` 渲染 aria-hidden 红色 `*`）承载，不进 vendor 的 `components/ui/`。

## 被否决的选项

frontend.md 内「表单」章节：frontend.md 现 68 行、预算 120 行，章节方案仅剩约 10 行生长余量，而表单域可见生长点（服务端字段级错误映射、文件上传、复杂联动）会反复触碰预算并牵动 frontend.md 其他章节的稳定性。自有 useZodForm hook / TanStack Form：生态与 zod 4 集成成熟度不及 react-hook-form（用户决策，2026-11-01）。改 vendor `field.tsx` 内置必填星标：`components/ui/` 升级以原样覆盖为准，手改会在下次升级时静默丢失。CSS `::after` 注入星标：生成内容无法挂 `aria-hidden`，对屏幕阅读器行为不可控，破坏 forms.md 规则 10。必填标识用文字替代 `*`：用户决策采用企业平台惯例的红色 `*`。

## 后果

`governance.md` 规模预算与结构检查预期、`docs/index.md`、`AGENTS.md` 读取顺序已同步修订；governance.md 原「超过 12 篇即视为不合格」与 13 篇预算的既有矛盾一并修正为「超过预算篇数即视为不合格」。后续表单规则只进 forms.md，frontend.md 不再承载表单细则。存量三处表单（login、register、menus-editor）按新规范迁移。
