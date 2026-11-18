# 组件契约（apps/web）

> 层：规范 · 时态：约束未来 · 失效：组件基座或设计令牌变更时

## 目的

承载按钮、输入、选择、徽标、浮层、图标与动效的尺寸/状态契约。设计语言、令牌、壳层与页面规则见 `web-ui.md`；本文件不重复令牌表与页面规则。

## 何时读取

- 新增或修改 `components/ui/**` 补丁、业务组件、表单控件、弹窗、图标、动效时。

## 适用范围

- 适用 `apps/web/components/ui/**` 的补丁与 `apps/web/features/**` 的业务组件。
- `components/ai-elements/**` 保持上游，不按本文件改造。

## 尺寸与密度

| 组件              | 高度                         | 圆角     | 字阶  | 备注                           |
| ----------------- | ---------------------------- | -------- | ----- | ------------------------------ |
| Button            | 28 sm / 34 default / 38 lg   | 7        | 13    | 图标 16；仅主操作使用 primary  |
| Input / Textarea  | 38 / min 80                  | 9        | 14    | 边框 `#71717A`（双主题同值）   |
| Select            | 34                           | 7        | 13    | 内容面板 12 + `shadow-overlay` |
| Badge             | 22                           | 6        | 12    | 不做大色块 pill                |
| Checkbox / Switch | 16 / 36×20                   | 4 / full | —     | 选中 `bg-primary`              |
| Dialog            | —                            | 16       | 14    | padding 24；`shadow-overlay`   |
| Table             | 表头 36 / 行 48·56 / 页脚 44 | 12 容器  | 14/14 | 交互规则见 `web-ui.md`         |

控件只允许 28/32/34/38 四档（32 限工具栏、表格工具行等紧凑交互区，经 Tailwind `h-8` 表达，表格工具行已系统性采用）；新增档位必须先改本节；涉及色彩令牌时先改 `globals.css`。 `UIC-7.1`

## 按钮与输入

- **Button**：primary 每屏 ≤1；ghost/outline 用于次级；danger 用 `text-destructive` 文本；link 只做文字链接。
- **焦点与边界**：控件边界 ≥3:1、焦点环 2px `ring-ring`，不改变尺寸；对比度由 `check:rules` 校验。 `UIC-7.7`
- **禁用**：opacity 50 且不可点击；图标 16 stroke 1.5。
- **Input/Textarea**：label 12 + 6px 间距；错误用 `text-destructive` + 边框；占位用 `text-muted-foreground`。
- **Select/Checkbox/Switch**：统一使用 `components/ui` 组件，不手写原生控件；选中态使用 primary；禁用态不可操作。

## 状态与徽标

- 状态 = 6px 圆点 + 文字；成功/警告/危险只做点、文字或 12% 浅底，不做整块填充。 `UIC-7.2`
- 状态文案必须中文（成功/失败/限流），不展示后端枚举值。
- 计数与元数据用 `font-mono` + `tabular-nums`，不用彩色 pill。

## 浮层

- Dialog/popover/dropdown/command palette 使用 `--shadow-overlay` + hairline border；内容区禁止阴影。
- Dialog 默认 448 宽、需更宽时显式 `className`；底部动作右对齐，主/次按钮顺序固定。
- 遮罩 `bg-black/25` + 2px backdrop blur；关闭按钮 28 图标按钮。 `UIC-7.3`

## 图标与动效

- 图标唯一来源 lucide，16/18px、stroke 1.5、颜色跟文字角色；表格单元格等紧凑区允许 12/14px 小图标；空态必须给图标。 `UIC-7.4`
- 动效 140ms 反馈 / 200ms 浮层 / 320ms 入场，单一曲线 `cubic-bezier(0.22,1,0.36,1)`；只动 transform/opacity/color；禁止循环装饰动画；`prefers-reduced-motion` 下降级。 `UIC-7.5`
- 不使用 emoji 当图标；不在图标上加独立颜色。

## vendor 补丁

- 允许对 `components/ui` 做「token 化 + 尺寸/密度」最小补丁；补丁必须：可回退、不改 API、在文件内注明回退条件。
- 新增/升级上游组件时，先核对 `UIC-7.1`~`UIC-7.5` 是否仍成立；不成立则先改补丁，不绕过。 `UIC-7.6`

## 验证方式

- `UIC-7.1` / `UIC-7.3`~`UIC-7.6`：代码 review + 浏览器截图（1440/390，明暗）。
- `UIC-7.2`：`pnpm check:rules` 的 token 对比度检查 + 状态色面积 review。
- 焦点态、禁用态、错误态、悬停态在改动页逐一走查。
