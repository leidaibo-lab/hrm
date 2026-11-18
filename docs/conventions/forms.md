# 表单规范（apps/web）

> 层：规范 · 时态：约束未来 · 失效：表单选型变化或治理决定变更时

## 目的

承载表单实现细则：状态管理、校验接入、错误展示、必填标识、可访问性。

## 何时读取

- 新增或修改 `apps/web` 下任何表单时。
- 评审表单 diff 时。

## 适用范围与不适用

- 适用：`apps/web/features/`、`apps/web/app/`、`apps/web/components/`（业务组件）下全部表单。
- 不适用：`components/ui/`、`components/ai-elements/`（vendor 产物）内部。

## 选型基座

react-hook-form + `@hookform/resolvers`（`zodResolver`）；校验 schema 唯一来源 `@cip/shared`（契约侧约定见 `contracts.md`）。

## 规则

1. **schema 单源**：表单校验必须引用 `@cip/shared` 导出的 zod schema 经 `zodResolver` 接入；纯 UX 约束在切片内以 shared schema 为基底派生（`extend` / `refine` / `.shape` 包接），禁止复制规则、禁止组件内裸写校验。验证：grep 组件文件内 `z.object`，人工复核每个命中必须以 shared schema 为基底。
2. **状态载体**：必须用 react-hook-form（`useForm`；跨组件树经 `FormProvider` + `useFormContext`），禁止用 useState 维护 fieldErrors / formError。验证：grep `features/` 内 fieldErrors / formError 的 useState。 `FRM-5.1`
3. **字段接入**：原生元素用 `register`；复合组件（Select、Checkbox 等非原生值协议）用 `Controller`。验证：人工 review。
4. **校验时机**：默认 `mode: onSubmit`；改 `onBlur` 需在 code review 说明理由。验证：人工 review。
5. **字段结构**：必须用 `components/ui/field.tsx` 组件族（`Field` + `FieldLabel` + `FieldError`，辅助说明用 `FieldDescription`）；字段错误直接绑定 `formState.errors`。验证：人工 review。
6. **表单级错误**：mutation 抛错必须经 `setError(root)` 落 `formState.errors.root`，以 `Alert`（`variant=destructive`）展示；禁止裸 `<p>` 报错。验证：grep `features/` 表单内裸 `text-destructive` `<p>`。
7. **必填标识**：必填字段必须经业务组件 `components/field-label.tsx` 以 `<FieldLabel required>` 标注（组件内渲染 aria-hidden 红色 `*`，控件配 required 或 aria-required）；可选字段禁止传 `required`，禁止手写 `*` 标记。验证：grep `features/` 表单内手写 aria-hidden 星标 + 人工 review。 `FRM-5.2`
8. **提交**：必须走切片 mutation hook（`handleSubmit` 内 `mutateAsync`）；`isSubmitting` 驱动提交按钮（disabled + 进行中文案）。选择集合型对话框（勾选集合 + 单动作提交、无文本字段录入，如分配角色、目录导入）豁免 RHF 包装，直接经切片 mutation hook 提交，但必须以进行中状态驱动按钮并按规则 6 展示错误。验证：沿用 `frontend.md` 数据流转规则 1 + 人工 review。 `FRM-5.3`
9. **回填**：必须走 `defaultValues` / `reset()`；禁止裸 `defaultValue` 属性与 `register` 混用。验证：grep `features/` 表单内 `defaultValue=`。 `FRM-5.4`
10. **草稿保护**：后台 refetch 禁止覆盖 dirty 字段；不同职责表单分别保存并 reset，禁止一处保存清空另一处未提交草稿。验证：交互行为测试。
11. **a11y 底线**：label 经 `htmlFor` / `id` 关联控件；错误经 `FieldError`（role=alert）；文本输入必须标注 `autoComplete` 语义。验证：Biome a11y 规则 + 人工 review。

## 验证方式

- `FRM-5.1` / `FRM-5.4` 由 `pnpm check:rules` 硬检；规则 1 / 6 / 7 由 `pnpm check:rules` 输出候选行，人工复核判定。
- Biome a11y 规则随 `pnpm lint` 执行。
