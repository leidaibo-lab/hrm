# TableView 表格视图

## 一、文档信息

| 项目     | 内容                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档编号 | PRD-TABLEVIEW                                                                                                                                |
| 版本     | 1.0                                                                                                                                          |
| 状态     | 开发中（核心实现与五个调用方迁移已落地，待产品复核）                                                                                         |
| 作者     | 产品与工程共同确认                                                                                                                           |
| 关联文档 | `../conventions/frontend.md`、`../conventions/contracts.md`、`../conventions/web-ui.md`、`../decisions/0035-prd-technical-execution-spec.md` |

### 版本记录

| 版本 | 日期       | 变更内容                                                   | 变更人                        |
| ---- | ---------- | ---------------------------------------------------------- | ----------------------------- |
| 1.0  | 2026-11-15 | 固化 TableView 产品交互、API、查询协议、迁移和执行验收规格 | 用户确认的方案，由 Codex 整理 |

## 二、概述

TableView 是管理界面中通用的只读数据表格视图，提供 Notion Database 风格的视图栏、搜索、筛选、排序、列设置、选择、行操作、分页及数据查询能力。业务只声明列、动作、范围和生成客户端请求；组件、前端查询工厂及后端通用查询能力承担重复的通用交互和协议工作。

## 三、背景与上下文

当前 `apps/web/components/table-view` 已有组合组件、URL 查询状态、TanStack Query、列工厂和若干子组件，但存在单筛选模型表达不了操作符、部分资源只消费第一条排序、模型查询忽略范围缓存、报表汇总经 query 闭包复制到 React state 等差异。当前 API 多为 GET 且各资源分页和查询能力不一致。

本 PRD 是 TableView 唯一功能交接主文档；仓库全局规范规定跨功能不变量。本文标记 `[已确认]` 为本次实现约束，`[待实现]` 为已定方案但源码尚未落地，`[延后]` 为明确不得扩展的范围。不得把本文中的目标路径、SDK 名称或示例误报为已存在事实。

## 四、目标与成功指标

| 目标                   | 成功指标                                                   | 基线                | 目标值                                 |
| ---------------------- | ---------------------------------------------------------- | ------------------- | -------------------------------------- |
| 各页面使用同一交互模型 | 五个现有表格均走统一 TableView 和查询协议                  | 能力与接口不一致    | 五个调用方完成迁移，无旧 props         |
| 交互与 Notion 约定一致 | 本文交互验收条目全部通过                                   | 已有多轮原型反馈    | 0 个未实现可见控件，桌面和窄屏通过     |
| 查询实现无重复适配代码 | 普通资源使用通用 `createTableQuery`，后端共用解析/执行能力 | 各 feature 手写映射 | 业务仅声明列能力、scope 和特殊字段策略 |
| 查询结果正确可复现     | 完整筛选、多级稳定排序、分页、汇总一致                     | 部分查询忽略参数    | API 行为测试覆盖全部规则               |

## 五、非目标（Out of Scope）

- 不做单元格内编辑、行拖动排序、列头菜单或 schema/property 编辑。
- 不做保存视图、视图分享短链接、条件分组/高级 AND-OR 构建器。
- 不做跨页全选、任意全量批量更新、通用任意字段编辑接口。
- 不增加本 PRD 规定六种操作符以外的筛选条件。
- 不引入 IndexedDB；不把查询状态写到 URL。
- 不把通用查询能力实现成可接受任意表名、数据库字段或 Prisma 表达式的万能数据库 API。
- 不扩大范围实现导出格式、导入流程、具体业务动作；这些仍由 feature 声明。

## 六、用户与场景

### 6.1 目标用户

| 角色          | 描述                                 | 核心诉求                               |
| ------------- | ------------------------------------ | -------------------------------------- |
| 管理员        | 在控制台管理成员、角色、供应商及模型 | 快速定位数据、安全执行行操作和批量操作 |
| 运营/审计人员 | 检索调用记录并阅读汇总               | 组合筛选、排序、翻页，保持结果一致     |
| 功能开发者    | 在不同 feature 中接入数据表          | 只声明业务差异，不重复编写表格查询协议 |

### 6.2 用户故事与场景

- 管理员展开表格搜索，搜索词按 debounce 生效；收起搜索保留关键词，明确清除后才移除。
- 用户通过筛选入口只看到列声明允许筛选的字段，填写完整条件后立即查询并在条件栏显示 chip。
- 用户从可排序字段选择器添加最多五条排序规则，改变顺序或方向后服务端按全部规则返回稳定结果。
- 用户设置列顺序、宽度、显示和冻结后关闭抽屉再打开，设置仍然存在；列布局改变不触发数据查询。
- 用户选择当前页行并执行批量动作；操作目标在动作开始时固定，部分失败保留失败行供处理。
- 用户在某供应商下打开模型表格，供应商范围不会与其他供应商缓存或持久化状态串用。

## 七、功能需求

### 7.1 功能列表与优先级

| 编号 | 功能点                                             | 优先级 | 依赖                          | 关联场景       |
| ---- | -------------------------------------------------- | ------ | ----------------------------- | -------------- |
| F1   | 查询状态、通用 POST 查询、缓存和持久化             | P0     | API 查询框架、Web 生成 client | 全部           |
| F2   | toolbar 搜索、筛选、排序和视图动作                 | P0     | F1、列能力定义                | 搜索/筛选/排序 |
| F3   | 列拖拽、列设置抽屉、冻结和偏好                     | P0     | 浏览器存储                    | 列布局         |
| F4   | selection、行/批量 actions、回调和错误状态         | P0     | 业务 mutation hooks           | 操作           |
| F5   | sticky header/footer、checkbox overlay、响应式布局 | P0     | 页面滚动约束                  | 桌面/窄屏      |
| F6   | 五个现有调用方完整迁移                             | P0     | F1-F5                         | 项目级一致性   |

### 7.2 功能详情

#### F1 查询与状态

- 有效状态为 `page`、`pageSize`、`q`、`filters`、`sort`；筛选编辑中的未完成草稿不属于有效查询。
- 初始值为 `{ page: 1, pageSize: 20, q: '', filters: [], sort: [] }`，可由 `defaultQuery` 覆盖。
- 搜索、筛选、排序、分页状态存 `sessionStorage`；列偏好存 `localStorage`；临时选择、浮层和拖拽草稿存内存；服务器响应只在 TanStack Query。
- 存储键隔离版本、`identityKey`、表格 `id` 和稳定序列化的 `scope`。`identityKey` 是缓存分区键，不是授权凭证；API 仍执行权限判定。
- session 状态恢复完成前不请求默认查询；无有效存储时使用 `defaultQuery`。损坏/过期数据校验后清理并退回默认值。存储不可用时退回内存。
- 当前确定不更新 URL，所以复制页面地址不包含表格状态，浏览器前进/后退不逐项恢复表格操作。
- 表格 queryKey 包含表格 ID、身份、scope 和规范化后的完整查询。筛选字段/枚举值可规范化，sort 顺序必须保留。
- `queryFn` 透传 `AbortSignal`。请求取消不触发错误回调，不重试；参数/权限类 4xx 不重试；网络和可重试 5xx 最多自动重试一次。过期响应不得触发当前查询回调。
- 翻页切换到目标页并清选择；每页条数、搜索、筛选及排序改变时回到第一页并清选择；列布局改变不发查询、不清选择。scope 改变时取消旧请求并清选择，恢复 scope 对应 session 状态或默认值。
- 同一查询的后台刷新保留数据与仍在当前页的选择；查询条件/页码变化期间若保留旧行，则必须标记过渡状态并禁用选择和行操作，不能操作旧页数据。
- 删除数据造成当前页越界时，组件至多修正页码并重新请求一次；空结果页显示 `1 / 1`。

#### F2 toolbar、搜索、筛选、排序

- 视图栏左侧为视图标题，右侧顺序为搜索、筛选、排序、列设置、自定义视图操作；不换行。搜索在右侧工具组首位，不是全视图栏最左端。
- `toolbar` 是视图栏操作的唯一配置入口。`searchable`、`filterable`、`sortable`、`columnSettings` 默认关闭；业务明确开启。列设置开启时默认可用，若没有可设置列则隐藏入口。
- 搜索 icon 原地展开无边框输入框并聚焦，默认 300ms debounce，输入法 composition 期间不提交。外部失焦/切换模式只收起并保留 query；清除按钮或输入框 Esc 清除并收起。
- 搜索展开与批量工具栏展示互斥，后发生的动作控制显示模式。搜索展开保留选择；搜索条件实际变化时清空选择。checkbox 选择会收起搜索，但保留有效关键词；选择清空后可恢复搜索展示。
- 筛选 chip 不默认显示。只有 `toolbar.filterable` 开启且列显式声明 `filter` 时，字段才可被添加。没有合格列时隐藏筛选入口。
- `+ 筛选` 打开可搜索字段选择器。选择字段后打开编辑器；不完整草稿不请求。条件有效后自动应用、生成 chip、回到第一页并清选择。同字段最多一个有效条件。清除条件同时清除 chip；不保留空快捷 chip。
- chip 中显示字段、操作符和值摘要；点击重开锚定编辑器，直接使用 X 清除，不提供 more 清除菜单。
- 筛选操作符全局封闭且只能是：等于 `eq`、不等于 `neq`、包含 `contains`、不包含 `not_contains`、早于 `before`、不早于 `not_before`。字段类型允许子集见 16.3，禁止实现额外操作符。
- 不同字段条件采用 AND。枚举多值 `eq` 表示命中任意一个，`neq` 表示全部排除。多选关系字段 `eq` 表示集合有交集，`neq` 表示无交集。`null` 不匹配正向或负向条件。文本 contains 使用字面子串、转义 `%`/`_` 且不区分大小写。
- 没有排序规则时打开可搜索的属性选择器；选择属性后默认升序并打开规则编辑器。多规则 chip 显示 `N 个排序`，位于筛选 chip 左侧并用短竖线分隔。
- 排序规则行包含拖拽把手、字段选择、方向选择和 X 删除；支持添加、删除全部和拖动优先级。不允许重复字段。`maxRules` 默认 5，达到上限禁用添加，但已有规则仍可改删。
- 列头不排序、不打开菜单。所有排序由服务器执行，未设置排序时资源使用确定的默认排序并以唯一 ID 做最终 tie-break。
- 自定义 toolbar actions：0 项不显示；1 项显示单个主按钮；多项第一项为主按钮并显示箭头，其余在菜单中。业务先过滤权限。主按钮禁用时不提升其他项，菜单不重复主按钮。动作无必需业务 `id`。

#### F3 列、设置抽屉和滚动

- 普通数据列默认左对齐；数字列默认右对齐；表头和内容对齐方向及左右内边距一致。操作标题右对齐到操作控件可见边缘，不显示左分割边框。
- 默认列宽按列配置，最小宽度默认 96px。列拖拽重排和 resize 把手是不同命中区域；resize 在 pointer up 提交，双击恢复默认宽；拖动超过 6px 才开始排序拖动。Escape 取消未提交拖动，支持键盘移动。拖动展示源列弱化、拖动预览、插入线及边缘自动滚动。
- `primary` 语义列保持移动端卡片标题，不随列重排变化。
- 普通列状态为 `order / widths / hidden / frozen`。列工厂可声明 `hideable`、`freezable`、`reorderable`、`resizable`；主列默认不可隐藏，其余默认可隐藏，其他能力默认开启。禁用属性必须同时约束抽屉和表头拖动入口。
- 视图栏设置按钮打开从右侧滑入的 Drawer，不使用 Popover。桌面宽约 360px，窄屏占可用宽度；抽屉含标题、列搜索、冻结列区、普通列区、恢复默认按钮。列表可独立滚动，底部恢复操作固定。
- 显示、冻结、排序即时生效并持久化，不设保存按钮；抽屉连续操作期间保持打开。关闭按钮、遮罩、Esc 关闭；焦点返回开启按钮。拖动期间第一次 Esc 取消拖动。
- 冻结列组成连续左侧区域。冻结时插入冻结区末尾，解冻时移至普通区开头；冻结区内部和普通区内部可排序；跨区拖动明确呈现冻结/解冻落点。隐藏冻结列不占宽度，恢复显示后回归冻结区。
- 冻结前需保证普通数据区至少保留 240px；空间不足则阻止显式新增冻结并说明。视口变窄导致超限时只临时降级实际粘滞数量，不覆盖保存偏好。右侧固定操作列宽度也计入视口占用。
- checkbox 不是真实表格列、不进入 colgroup、不进入列偏好、不占宽、不产生边框或占位。第一真实列从页面内容基线开始。checkbox overlay 固定在表格左侧已有留白之外，横向滚动不移动；纵向随对应可见行和 sticky 表头对齐。
- 未选中时默认隐藏 checkbox；悬浮行显示该行 checkbox；悬浮左侧 checkbox gutter 时显示可见行 checkbox 整列及表头；已选始终显示，表头三态；焦点可访问，触屏常显。仅当前页选择。
- 表头默认 sticky。横向滚动仅包含表头和数据区；横向滚动条位于数据区域。分页底栏是滚动区的兄弟区域，不随横向滚动。
- 底栏默认 `sticky`：数据区不超过可用最大高度时短表的分页紧跟数据；超过时仅数据区纵向滚动、底栏在视口底部。`flow` 模式跟随表格纵向内容移动，但仍固定横向位置且保留 sticky 表头；必须独立验证纵向滚动容器。
- 底栏左侧固定文案 `第 x / x 页，共 x 条数据`；右侧每页数量、前后页及桌面页码组。窄屏单行且不重复展示页码组。每页条数为 10/20/50/100，默认 20。
- 操作列由 `layout.pinActions` 控制是否右侧 sticky，默认 false。操作区最多两个直接文本动作，其余进入更多菜单。权限过滤由业务完成，行条件由 `when` 决定；危险动作使用确认配置。

#### F4 空态、错误态、回调和动作

- `empty` 接受可选 `{ icon, title, description, action }`，组件负责统一居中、间距、token、暗色和窄屏样式；无配置默认“暂无数据”。空态占可视宽度，不随横向滚动偏移，保留表头和分页。
- 搜索/筛选无结果显示专用无结果态及清除搜索/筛选操作（保留 sort/pageSize）；首次加载显示 skeleton；查询失败显示 retry；后台刷新保留旧数据并显示刷新状态。
- 查询响应 `TableData<T, TMeta> = { rows: T[]; total: number; meta?: TMeta }`。可选 `renderMeta(meta, { fetching, stale })` 供报表显示同一 query cache 中的汇总，普通表格不需要实现；不得在 query 回调中 setState 复制服务端汇总。
- 回调：`onQueryChange({ previous, next, reason })`、`onSelectionChange({ ids, rows, reason })`、`onColumnStateChange({ previous, next, reason })`、`onLoadSuccess({ data, query })`、`onLoadError({ error, query })`、`onActionStart / onActionSuccess / onActionError`、`onRowClick(row)`。
- `onQueryChange` 只在有效状态变化时调用；初次 default 恢复不是用户变化。`onLoadSuccess` 只对当前网络请求实际成功调用，cache hit 不调用。`onLoadError` 只在最终失败调用。回调自身抛错不得被当作查询失败或触发重试。加载回调不是数据源。
- 状态原因集合至少包括 search/filter/sort/page/pageSize/reset/scope/pageCorrection；选择原因 row/all/clear/query/scope/data/action；列原因 reorder/resize/visibility/freeze/reset。
- 通过 `ref` 提供 `refresh()`、`resetQuery()`、`clearSelection()`、`resetColumns()`、`getQuery()`。重置查询回到 `defaultQuery`；重置列设置删除用户偏好。
- `actions` 是行操作，`toolbar.actions` 是视图操作，`selection.actions` 是批量操作。三类共用 label/icon/danger/enabled/confirm/onRun 语义，执行上下文各自为 query control、row、固定的 selected rows。
- 操作无需业务 id。组件内部 pending 绑定当前动作实例和捕获的目标 row IDs；数组变化、选择变化不改变已开始动作的目标，不把 pending 转移到其他动作。
- 批量动作允许返回 `{ succeededIds, failed: [{ id, error }] }`；成功项取消选中，失败项保留并呈现结构化错误。整体成功/失败由动作 promise resolve/reject 表达。普通公共类型使用 `TableError`，不依赖 feature 的 `ApiError` 类。
- 写 mutation 和缓存失效归业务 API hook；TableView 负责统一 pending、确认、回调和结果反馈，不自动重复请求。

## 八、交互与设计

规范交互基准为 Notion Database 的已观察行为，并受本项目 web UI 令牌约束。颜色、圆角、浮层阴影服从 `../conventions/web-ui.md`；业务页面不重复设计自定义空态、列设置面板或筛选编辑器。原型仅辅助视觉核对，不覆盖本 PRD 的文字约束。

## 九、非功能需求

| 类别   | 要求                                          | 可判定指标                                           |
| ------ | --------------------------------------------- | ---------------------------------------------------- |
| 性能   | 关键词 300ms debounce；条件变化取消旧请求     | 快速输入只以最终状态作为活动查询；旧结果不覆盖新结果 |
| 安全   | 后端字段白名单、权限范围强制 AND、参数化查询  | 请求不能注入数据库字段/表达式或绕过资源权限          |
| 兼容性 | 单一新契约，不兼容旧 table-view 参数/URL 解析 | 全部调用方迁移；无旧 API 分支                        |
| 可用性 | 键盘、触屏、焦点恢复、暗色、小屏              | 交互清单在桌面/窄屏、键盘路径通过                    |

## 十、数据需求

本功能不增加业务表或持久化服务端数据。浏览器偏好存储 schema 有版本；查询响应和汇总只存 TanStack Query cache。未来保存视图若需要服务端表另立需求。

## 十一、假设与依赖

- 假设：资源端点可以改造并一次性切换，不需要旧接口兼容窗口。
- 依赖：Nest Zod DTO、Swagger OpenAPI、生成的 Web client、TanStack Query、应用 session identity、现有 Prisma repositories。
- 普通 TableView 只读查询；业务 mutation 继续使用各 feature 已有接口。
- 表格当前五个实际调用方：`users-table`、`roles-table`、`providers-table`、`models-panel`、`usage-report`。

## 十二、里程碑

| 阶段              | 范围                                                    | 完成条件                           |
| ----------------- | ------------------------------------------------------- | ---------------------------------- |
| M1 通用协议       | shared 枚举、API query 工厂、后端通用查询解析/执行定义  | 有端到端成员查询测试和 OpenAPI SDK |
| M2 TableView 核心 | types/columns/query state/query/cache/callbacks/storage | 组件和状态行为测试通过             |
| M3 交互视图       | toolbar/filter/sort/drawer/selection/empty/footer       | 桌面、窄屏、键盘视觉验收通过       |
| M4 业务迁移       | 五个调用方、适配器和 API 字段定义                       | 每项声明的能力均由接口真实支持     |
| M5 收口           | 文档、测试、OpenAPI、lint、typecheck、差异检查          | PRD 验收矩阵全部通过，无旧入口     |

## 十三、验收标准

- 六种且仅六种筛选操作符，前端列定义和后端 DTO 字段矩阵一致。
- 各资源完整消费 `q / filters / sort / page / pageSize / scope`，不忽略不支持的条件；多列排序有唯一 ID 稳定 tie-break。
- POST `/query` 返回 HTTP 200；OpenAPI 生成 SDK 类型被 feature 查询工厂消费。
- `createTableQuery({ request })` 可直接内联 TableView `query`；不会因函数重建单独产生 cache miss 或重复请求。
- 通用后端解析/执行能力处理共性；普通资源无需复制操作符解析、日期转换、分页和响应映射；特殊字段显式提供资源 mapping/resolver。
- `scope` 同时传入请求并进入 cache/storage key；供应商、身份切换无跨范围瞬时数据泄露。
- 筛选器只开放声明列；无默认 chip；完整后应用；六种操作语义及 null 边界测试通过。
- `empty` 有统一样式；空结果、无结果、加载、错误和后台刷新状态正确区分。
- 列设置为右侧 Drawer；显示、顺序、宽度、隐藏、冻结恢复；约束项不能从其他入口绕过。
- checkbox 不影响真实列宽、表头位置或横向滚动；底栏始终不随横向滚动。
- 小屏 toolbar、条件区域和 footer 不发生换行或动作不可达。
- 行/视图/批量动作正确确认、pending、报告错误；批量部分成功只清除成功项。
- 回调的触发次数和原因通过测试覆盖，回调异常不污染取数状态。
- 五个现有调用方不再使用旧 props、旧 query DTO、URL 表格参数或本地复制的 query state。
- 所有仓库验证命令按 `../reference/verification.md` 执行并报告真实结果；不得以静态审阅代替实施验证。

## 十四、开放问题

无。实现阶段发现后端共享查询定义无法表达资源特殊逻辑时，必须先缩小通用层职责并更新本文，不得另造未经确认的并行协议。

## 十五、附录

本文相关长期规范见 `../conventions/contracts.md`、`../conventions/frontend.md` 和 `../conventions/web-ui.md`。ADR-0035 记录 PRD 可承载技术执行规格的治理决定。

## 十六、技术执行规格

### 16.1 最终决策与状态

| 状态     | 决策                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------- |
| [已确认] | TableView 只读；列重排是唯一数据列拖拽能力；筛选操作符固定六种                                  |
| [已确认] | 查询使用每资源 POST `/query`；查询状态 sessionStorage；列偏好 localStorage；不使用 URL 保存查询 |
| [已确认] | 视图栏统一 `toolbar`；行操作 `actions`；选择使用 `selection.enabled/actions`                    |
| [已确认] | 不兼容旧 props、旧 query 类型、旧 URL 状态或旧服务端查询参数；调用方一次性迁移                  |
| [已确认] | 前端工厂及后端查询能力已进入源码；当前实际路径见架构总览，本文目录树保留设计职责                |
| [已确认] | 成员、角色、服务商、模型和用量资源已迁移到 POST 查询；尚未部署                                  |
| [延后]   | 保存/分享视图、URL 短码、跨页全选、单元格编辑、高级筛选分组和 IndexedDB                         |

实现时如果确需改变 `[已确认]` 决策，先更新本 PRD 的变更记录并报告影响，禁止静默变更。

### 16.2 系统边界与数据流

```text
业务 Feature Table
  → TableView（UI 状态 / session 与 local 偏好 / 选择 / 回调）
  → useQuery（key = tableId + identity + scope + normalized query；透传 signal）
  → createTableQuery({ request })（统一序列化、日期、错误和响应适配）
  → OpenAPI 生成的 SDK POST /api/v1/<resource>/query
  → Nest DTO 校验 → Controller/guard → Application 查询用例
  → 资源 QueryDefinition + 权限强制范围
  → 通用安全查询执行器 / 资源 repository → items,total,meta
```

前端只持有展示字段 id，不持有数据库列名。后端声明是安全边界，前端列声明是交互边界，两边不能互相替代。查询和批量写动作是不同数据流；写动作走业务 mutation hooks。

### 16.3 公共 API 与类型

#### 公共枚举

跨端筛选操作符、HTTP 排序方向放 `packages/shared`，使用字符串枚举并由 API DTO 引用：

```ts
export enum FilterOperator {
  Equal = 'eq',
  NotEqual = 'neq',
  Contains = 'contains',
  NotContains = 'not_contains',
  Before = 'before',
  NotBefore = 'not_before',
}

export enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}
```

Web 交互类型 `FilterKind` 放 TableView 本地类型模块：`Text='text'`、`Number='number'`、`Enum='enum'`、`Date='date'`。`kind` 只供 Web 控件和查询状态辨别，HTTP 不传此字段。共享包不依赖 React 或 Nest。

#### 筛选条件

```ts
type TextFilter = {
  kind: FilterKind.Text;
  field: string;
  operator:
    | FilterOperator.Equal
    | FilterOperator.NotEqual
    | FilterOperator.Contains
    | FilterOperator.NotContains;
  value: string;
};

type NumberFilter = {
  kind: FilterKind.Number;
  field: string;
  operator: FilterOperator.Equal | FilterOperator.NotEqual;
  value: number;
};

type EnumFilter = {
  kind: FilterKind.Enum;
  field: string;
  operator: FilterOperator.Equal | FilterOperator.NotEqual;
  values: string[];
};

type DateFilter = {
  kind: FilterKind.Date;
  field: string;
  operator: FilterOperator.Before | FilterOperator.NotBefore;
  value: number; // Unix milliseconds
};

type FilterCondition = TextFilter | NumberFilter | EnumFilter | DateFilter;
```

`FilterKind` 和字符串枚举同时存在是有意的：kind 是值类型分类，不是可操作符列表；每个 union 分支继续收窄到合法操作符和值形态。列工厂的 `filter.operators` 只允许对应分支的子集。

日期输入按列声明的 IANA 时区和 day/datetime 粒度解释。日期粒度在所选日的本地时区零点转换为 Unix 毫秒；早于 `< cutoff`，不早于 `>= cutoff`。组件状态/存储使用毫秒，HTTP 用 ISO 8601 UTC；秒不得混用。不能用宿主本地时区隐式解释日期。

#### 查询和结果

```ts
type SortRule = {
  field: string;
  direction: SortDirection;
};

type TableQuery = {
  page: number;
  pageSize: number;
  q: string;
  filters: FilterCondition[];
  sort: SortRule[];
};

type TableScope = Readonly<Record<string, string | number | boolean | null>>;

type TableData<T, TMeta = unknown> = {
  rows: T[];
  total: number;
  meta?: TMeta;
};

type TableQueryContext = {
  signal: AbortSignal;
  scope: TableScope;
};

type TableQueryFn<T, TMeta = unknown> = (
  query: TableQuery,
  context: TableQueryContext,
) => Promise<TableData<T, TMeta>>;
```

#### `createColumns`

回调式 factory 绑定行泛型一次，并只导入本表需要的工厂：

```tsx
const userColumns = createColumns<UserRow>(
  ({ primary, text, status, number, date }) => [
    primary('name', '成员', {
      meta: (row) => row.username,
      sortable: true,
    }),
    text('email', '邮箱', {
      filter: {
        operators: [
          FilterOperator.Equal,
          FilterOperator.NotEqual,
          FilterOperator.Contains,
          FilterOperator.NotContains,
        ],
      },
    }),
    status('status', '状态', STATUS_OPTIONS, {
      filter: {
        operators: [FilterOperator.Equal, FilterOperator.NotEqual],
        multiple: true,
      },
    }),
    number('roleCount', '角色数', {
      accessor: (row) => row.roleIds.length,
      sortable: false,
    }),
    date('createdAt', '加入时间', {
      sortable: true,
      filter: {
        operators: [FilterOperator.Before, FilterOperator.NotBefore],
        granularity: 'day',
        timeZone: 'Asia/Shanghai',
      },
    }),
  ],
);
```

普通字段名须受 `keyof T` 检查；派生字段可以自定义 ID，但必须有 `accessor`。日期/文本/枚举工厂以类型限制操作符，不接受业务传 `kind`。列图标由工厂默认：text Type、primary Text、date Calendar、number Hash、id Fingerprint、link Link、status Activity、select Tag、multiselect Tags、switch ToggleLeft、person User；`icon` 可覆盖。`option.success/neutral/warning/danger(label)` 返回 `{ label, tone, icon? }` 语义选项；渲染层根据 tone 适配状态点、chip 或筛选选择，不允许业务传 Tailwind class。

列字段定义：`id/header/icon/align/width/minWidth/maxWidth/primary/secondary/sortable/filter/resizable/hideable/freezable/reorderable/accessor/cell`。stable `id` 不随显示文案变化。默认尺寸/对齐遵循 F3。`filter` 未声明即不可筛选；`toolbar.filterable` 只总开关，不授权额外字段。

#### 组件 Props

```ts
type ToolbarConfig = {
  searchable?: boolean | { placeholder?: string; debounceMs?: number };
  filterable?: boolean;
  sortable?: boolean | { maxRules?: number };
  columnSettings?: boolean;
  actions?: ViewAction[];
};

type TableViewProps<T, TMeta = unknown> = {
  id: string;
  identityKey: string;
  title?: string;
  scope?: TableScope;
  query: TableQueryFn<T, TMeta>;
  columns: TableViewColumn<T>[];
  rowKey: (row: T) => string;
  toolbar?: ToolbarConfig;
  actions?: RowAction<T>[];
  selection?: { enabled: boolean; actions?: BulkAction<T>[] };
  defaultQuery?: Partial<TableQuery>;
  layout?: {
    maxHeight?: number | 'available';
    footerMode?: 'sticky' | 'flow';
    pinActions?: boolean;
  };
  empty?: {
    icon?: LucideIcon;
    title?: string;
    description?: string;
    action?: ViewAction;
  };
  renderMeta?: (
    meta: TMeta | undefined,
    state: { fetching: boolean; stale: boolean },
  ) => React.ReactNode;
  renderRowDetail?: (context: { row: T; close: () => void }) => React.ReactNode;
  onQueryChange?: (event: QueryChangeEvent) => void;
  onSelectionChange?: (event: SelectionChangeEvent<T>) => void;
  onColumnStateChange?: (event: ColumnStateChangeEvent) => void;
  onLoadSuccess?: (event: LoadSuccessEvent<T, TMeta>) => void;
  onLoadError?: (event: LoadErrorEvent) => void;
  onActionStart?: (event: ActionEvent) => void;
  onActionSuccess?: (event: ActionEvent) => void;
  onActionError?: (event: ActionErrorEvent) => void;
  onRowClick?: (row: T) => void;
};
```

配置约束：search/filter/sort/settings 默认 false；没有对应列时入口隐藏；`rowKey` 必填。列设置由 `toolbar.columnSettings` 控制。`selection.enabled` false/缺省时不渲染勾选和批量栏。`bulk actions` 存在而 selection 未启用属于开发期配置错误。

#### 回调和 Handle

回调只观察 TableView 管理的状态，不承担加载数据：`onQueryChange({ previous,next,reason })`、`onSelectionChange({ ids,rows,reason })`、`onColumnStateChange({ previous,next,reason })`、`onLoadSuccess({ data,query })`、`onLoadError({ error,query })`、动作 start/success/error 和 `onRowClick(row)`。原因枚举按 F4。回调异常被单独捕获/报告，不进入 query retry。

`ref` 提供 `refresh(): Promise<void>`、`resetQuery(): void`、`clearSelection(): void`、`resetColumns(): void`、`getQuery(): TableQuery`。这些是 imperative 辅助能力，不复制受控 props API。

```ts
type TableError = {
  message: string;
  code?: string;
  status?: number;
  traceId?: string;
  errors?: readonly unknown[];
};

type BulkResult = {
  succeededIds: string[];
  failed: Array<{ id: string; error: TableError }>;
};
```

动作配置不含必填 id。`ViewAction` 上下文提供 `{ query, refresh, resetQuery }`；`RowAction<T>` 上下文为 row，可用 `when(row)` 隐藏业务不适用项；`BulkAction<T>` 收到动作开始时捕获的 readonly rows。支持 `enabled(context)`、`confirm`、`danger`、`onRun(context)`。权限动作由业务先过滤。批量结构化部分结果只清除成功 IDs，失败行保留。

### 16.4 前端实现

#### 通用 query factory 和页面调用

```tsx
<TableView
  id="iam-users"
  identityKey={currentUserId}
  query={createTableQuery({ request: queryUsers })}
  columns={userColumns}
  rowKey={(row) => row.id}
  toolbar={{
    searchable: { placeholder: '输入并搜索…', debounceMs: 300 },
    filterable: true,
    sortable: { maxRules: 3 },
    columnSettings: true,
    actions: viewActions,
  }}
  actions={rowActions}
  selection={{ enabled: true, actions: bulkActions }}
  defaultQuery={{
    pageSize: 20,
    sort: [{ field: 'createdAt', direction: SortDirection.Desc }],
  }}
  empty={{ title: '暂无成员', description: '添加成员后，可在这里管理账号。' }}
  onQueryChange={handleQueryChange}
/>;
```

`queryUsers` 是 feature API 对生成 `userControllerQuery` 的原样再导出，组件不直接调用生成 SDK。普通表格行类型由 request 推导；复杂汇总插槽可以显式写 `TableView<UsageRow, UsageSummary>` 保持类型精度。

`createTableQuery` 是同步工厂，不在创建时发请求。可以直接写在 `query` prop 内，无需额外变量、`useMemo` 或 `useCallback`。它把 `TableQuery + scope + signal` 序列化到生成 SDK request，并将 `{items,total,meta}` 映射到 `{rows,total,meta}`；删除本地 `kind`、把日期毫秒转 ISO UTC、保留结构化 error。query cache key 不包含 request 函数引用，因此渲染重建函数不能导致 cache miss/re-fetch。厂函数只处理通用协议；特殊字段类型/映射在后端字段 schema 中解决，异常业务映射通过受类型约束的 option 提供，而不是所有 feature 重写通用转换。

请求工厂签名应使用生成 client 的 request/body 类型推导，禁止手写 HTTP DTO：

```ts
createTableQuery({ request: generatedSdkQuery });
```

资源 query 请求体可以包含资源 scope。模型列表例：`scope: { providerId }`；scope 同时进入 request/cache/session storage。业务必需范围尚未就绪时由上层挂载边界阻止，不先发一个无范围请求。后端不可把客户端 scope 当权限依据，必须再次鉴权。

#### 列选项 factory

```ts
const STATUS_OPTIONS = {
  active: option.success('启用'),
  suspended: option.neutral('停用'),
};
```

所有状态列和筛选器共享 label/tone/icon。theme style 映射集中在 TableView，不将 class 字符串当数据。

#### query state 和持久化 Hooks

- 公共 Web hooks 分为 `useLocalStorage<T>({ key, schema, defaultValue })` 与 `useSessionStorage<T>({ key, schema, defaultValue })`，底层允许共享私有存储工具。
- 存储 hook 返回 `{ value, ready, error, setValue, reset }`；SSR 首次 render 安全，客户端 ready 前不写默认值。
- TableView 使用 `useTableQueryState` 和 `useTablePreferences` 封装业务 schema。查询值落 sessionStorage；列状态落 localStorage。
- 列状态保存 `order:string[]`、`widths:Record<string,number>`、`hidden:string[]`、`frozen:string[]`。损坏项过滤；删除列 ID 清理；新列追加；reset 删除存储并恢复列 factory 初值。
- mutation 成功按 TableView key 前缀 invalidate；scope 和身份变化取消旧请求。TanStack Query 只存 server state，不复制 summary 到 React state。

### 16.5 后端接口与通用查询能力

#### HTTP 请求/响应

成员示例：

```http
POST /api/v1/users/query
Content-Type: application/json
```

```json
{
  "page": 1,
  "pageSize": 20,
  "q": "张",
  "scope": {},
  "filters": [
    { "field": "status", "operator": "eq", "values": ["active"] },
    {
      "field": "createdAt",
      "operator": "not_before",
      "value": "2026-10-31T16:00:00.000Z"
    }
  ],
  "sort": [
    { "field": "createdAt", "direction": "desc" },
    { "field": "name", "direction": "asc" }
  ]
}
```

普通资源 `scope` 可省略；它属于共用外壳的可选资源字段。OpenAPI 资源 schema 明确 scope keys，而不是任意 object 放行。HTTP filter 不发送 `kind`：DTO 根据 field definition 推断类型。

```json
{
  "items": [],
  "total": 0
}
```

需要汇总的用量接口：

```json
{
  "items": [],
  "total": 0,
  "meta": {
    "totalCalls": 0,
    "totalCost": null
  }
}
```

所有结果都用裸载荷和 HTTP 200；错误使用项目已有 RFC 9457。offset page 不附空的 `nextCursor`。分页上限 100、默认 20；`q` 长度限制由资源定义（当前 users 64）；sort 默认最多 5。部署此功能不新增旧请求兼容分支，不保留旧 GET table endpoints 的表格消费。

#### 六个操作符语义

| kind/资源字段类型     | 可用操作符                      | HTTP value       |
| --------------------- | ------------------------------- | ---------------- |
| text                  | eq、neq、contains、not_contains | string           |
| number                | eq、neq                         | number           |
| enum/status/person ID | eq、neq                         | values: string[] |
| date/datetime         | before、not_before              | ISO UTC string   |

每 field 最多一条条件；filter 不同 field AND；枚举值按 `eq ANY(values)`、`neq NONE(values)`。文本大小写不敏感，`%`、`_` 字面转义。日期值是一个截止时刻，不早于即包含该时刻。`null` 明确排除于正负条件，不新增 null 专属操作符。

#### 后端通用查询能力

实现通用能力而不是每个 resource 手写 parser/executor，也不建立任意表查询接口：

1. `apps/api/src/platform/table-query/`（目标待创建）提供共享 DTO primitives/definition builder/validation normalization/safe plan types；是否全部归 platform 由依赖图约束验证。禁止依赖业务 module。
2. 资源 DTO 从定义派生字段及操作符约束，再导出该资源自己的请求 schema 和 OpenAPI；Nest DTO/OpenAPI 是 HTTP 契约唯一事实来源。
3. 每资源声明 `QueryDefinition`：公开字段、kind、filter operators、searchable、sortable、默认 sort、分页上限及资源 scope schema。
4. Application 先执行用户/资源权限，组合不可由客户端覆盖的强制 where，再调用资源 repository/query adapter。
5. 通用 executor 只处理标准逻辑：字段白名单→安全内部字段映射、filters AND、运算符语义、多 sort、offset pagination、stable ID tie-break、相同条件 total。
6. Prisma/存储适配必须用类型化 allowlist 构造查询，参数化输入，不接收 SQL、Prisma where/orderBy 或 DB column 来自客户端。
7. 关联、派生、全文检索和复杂 summary 声明 resource resolver；通用框架提供可扩展 hook，但不假设能推导业务关系。
8. 共用 DTO shell 可以复用，但每个资源仍有自己的 `POST /query` endpoint、权限、scope 和 response schema，避免一个万能接口绕过资源审查。

目标配置示例：

```ts
const usersQuery = defineTableQuery({
  fields: {
    name: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    email: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    status: field.enum(UserStatus, { sortable: true, filter: enumOperators }),
    createdAt: field.date({ sortable: true, filter: dateOperators }),
  },
  defaultSort: [{ field: 'createdAt', direction: SortDirection.Desc }],
  maxPageSize: 100,
  maxSortRules: 5,
});
```

此为目标 API，不代表仓库已有 `defineTableQuery/field`。实现者可以调整私有 builder 形态，但不能改变 HTTP 语义、allowlist 和共享/资源边界。

#### 资源端点映射

| 资源      | 目标查询端点                                 | 注意事项                                                                |
| --------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| users     | `POST /api/v1/users/query`                   | q、status、text/date 字段、多 sort、offset                              |
| roles     | `POST /api/v1/roles/query`                   | 当前全量列表需实现真正分页和搜索/声明能力                               |
| providers | `POST /api/v1/model-gateway/providers/query` | status 是 enabled 投影字段，显式 resolver                               |
| models    | `POST /api/v1/model-gateway/models/query`    | providerId scope 参与请求、cache 和 session；修当前 scope 闭包缓存问题  |
| usages    | `POST /api/v1/model-gateway/usages/query`    | model/caller/status/date filters；summary 放 `meta`，同过滤范围跨页统计 |

### 16.6 文件结构与职责

以下是本轮落地后的源码映射（非待创建文件清单）。后续维护先核对实际路径，禁止按早期讨论再次创建并行 executor/schema 或重复组件。

```text
packages/shared/src/table-query.ts
  FilterOperator/SortDirection、纯条件模型、defineTableQuery/field、schema/plan、响应 schema

apps/api/src/platform/table-query/
  index.ts                          对外唯一出口
  table-query.service.ts            白名单字段绑定、where/order/page 安全组装
  __tests__/table-query.spec.ts      纯组装与非法绑定测试

apps/web/lib/
  table-query.ts                    SDK 自动类型推导、通用序列化、错误和结果适配
  browser-storage.ts                安全读写、schema 校验和降级
apps/web/hooks/
  use-local-storage.ts              local hook 与共同存储生命周期
  use-session-storage.ts            session hook

apps/web/components/table-view/
  index.ts                         公共出口
  table-view.tsx                   布局组合、详情/条件编辑状态、Handle
  types/{query,column,actions}.ts  公共 props/枚举/动作/事件/列类型
  columns/create-columns.ts       回调式泛型列工厂
  columns/option.ts               语义选项工厂
  columns/{basic,entity,shared}.tsx 列渲染和默认值
  model/normalize-query.ts        查询规范化、缓存键、时区转换
  model/normalize-columns.ts      列偏好清理/合并
  model/{filter-fields,column-capabilities,render-state}.ts 纯能力和渲染模型
  model/{scope-key,action-key}.ts  范围和动作内部标识
  hooks/use-table-view-controller.ts 查询/列/动作/选择编排
  hooks/use-table-view-state.ts   session 查询恢复和事件
  hooks/use-table-query.ts        TanStack Query、signal、网络回调
  hooks/use-table-preferences.ts  local 列偏好
  hooks/use-table-selection.ts    当前页选择
  hooks/use-table-actions.ts      确认、pending、结构化失败及回调隔离
  hooks/use-table-action-items.ts 视图/批量动作展示闭包
  hooks/use-table-drag.ts         指针/键盘列重排与自动滚动
  hooks/use-column-resize.ts      宽度草稿、取消和提交
  hooks/use-column-settings.tsx   Drawer 绑定与冻结约束
  hooks/use-flow-header.ts        外层纵向滚动中的表头粘滞偏移
  parts/view-bar.tsx              单行 toolbar 和搜索/多选展示模式
  parts/{filter-bar,filter-editor,filter-chip,sort-popover}.tsx 条件区和锚定编辑器
  parts/column-settings-drawer.tsx 右侧设置抽屉
  parts/{data-table,table-cards,table-view-data-area}.tsx 数据渲染
  parts/{checkbox-overlay,select-column}.tsx 悬浮勾选
  parts/{action-cell,table-footer,column-drag-preview}.tsx 操作、分页、拖拽预览
  parts/{empty-state,table-view-status,table-status-content}.tsx 标准状态展示
  parts/row-detail-drawer.tsx     行详情
  __tests__/                      组件和生命周期回归测试

apps/api/src/modules/<domain>/
  <resource>.controller.ts         POST query、权限、200 与出站 schema
  dto/<resource>.dto.ts            资源字段能力和派生 query schema
  application/<resource>.service.ts 用例及业务范围检查
  domain/<resource>.repository.ts  不依赖 HTTP DTO 的纯端口
  infrastructure/<resource>.prisma.repository.ts 资源字段绑定/投影和查询

apps/web/features/<domain>/api/<resource>.ts
  生成 SDK query 原样再导出、业务 mutation 与失效范围
apps/web/features/access-control/hooks/use-roles-export.ts
apps/web/features/model-gateway/hooks/use-providers-export.ts
  复用既有 CSV 业务格式，按需获取完整权限范围的数据
```

资源字段定义当前在 DTO，内部 plan 的纯模型在 shared，具体 ORM 映射在 platform/资源 infrastructure；层间禁止反向引用 DTO 或业务模块。无需额外 `<resource>-query.ts` 为每张表复制转换。组件文件上限及依赖方向继续遵循全局规范。

### 16.7 现有代码迁移

| 调用方                                                                 | 当前差异                                                                       | 迁移要求                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `apps/web/features/access-control/components/users-table.tsx`          | GET query adapter only first sort and scalar status                            | POST query; full filters/sorts; new toolbar/actions/selection/empty props      |
| `apps/web/features/access-control/components/roles-table.tsx`          | fetches full list, query only sort                                             | backend paging/search/supported fields; no fake client paging                  |
| `apps/web/features/model-gateway/components/providers-table/index.tsx` | full list and local sort behavior                                              | POST paging/search/status/sort per declaration                                 |
| `apps/web/features/model-gateway/components/models-panel/index.tsx`    | provider closure query omits table params; provider scope not in TableView key | explicit scope, API body includes providerId, paging/sort/search contract      |
| `apps/web/features/model-gateway/components/usage-report.tsx`          | first sort/filter values; summary copied through setState closure              | POST full query, summary response `meta`, `renderMeta`, no copied server state |

Also update all other `TableView` usages found with `rg`, exports and tests. Do not retain `searchable/selectable/bulkActions/rowActions/stickyFooter/emptyState` compatibility aliases or parse legacy URL keys. This is a currently isolated breaking component/API change and all in-repo callers move atomically. Existing standalone non-table GET list consumers may retain their endpoint where not part of the TableView flow; do not migrate unrelated API callers without need.

### 16.8 测试与验证矩阵

| 层                  | 必测行为                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shared              | operator/direction enum values, no duplicate alternate values                                                                                                                   |
| web pure model      | query normalization, empty draft exclusion, timezone day cutoff, query key scope identity, preference migration/cleanup                                                         |
| React component     | callback reasons/counts, search debounce/composition, mode arbitration, filter condition application, selection stale-row lockout, action pending/partial failures, ref methods |
| browser interaction | column pointer/keyboard DnD, resize/reset, Drawer focus/Escape, sticky header/footer, horizontal invariant, checkbox overlay, mobile no-wrap, dark theme                        |
| API DTO             | every allowed field/operator/value pair, rejected unknown field/op/duplicate, dates ISO, page and sort caps                                                                     |
| API behavior        | filter semantics including null and wildcard literal, all sort rules + stable ID, permission scope AND, items/total/meta same conditions, 200 response, no side effects         |
| OpenAPI/client      | resource query body/response reflected in generated client and consumer compiles                                                                                                |
| migration           | all five callers use new API; no old TableView prop or state parser remains                                                                                                     |

命令选择只从 `../reference/verification.md` 注册表读取；API 契约执行 api tests/typecheck/codegen/Web consumption；Web 组件执行 tests/typecheck/lint/check:rules；最后文档执行 check:docs/check:rules，并按保护治理要求处理 docs checker 变更。浏览器互动不能只以源码断言，需要真实鼠标/键盘和滚动检查。

### 16.9 发布、回滚与风险

- 同一版本提交前后端 DTO、OpenAPI 生成消费侧、Web TableView 和五个调用方；不使用旧新双协议窗口。
- 回滚以单一 revert 本功能提交/变更集为主；若已部署服务和 Web 不同版本，先恢复后端新旧端点部署顺序，避免前端调用不存在接口。不要回滚无关提交。
- 风险：通用查询 executor 若过度承诺 ORM 通用性会侵入资源层；以标准安全 plan + resource resolver 控制边界。
- 风险：日期 day boundary 会受 DST 影响；始终用 IANA timezone 计算指定日零点并转 instant。
- 风险：`flow` footer 结构最复杂，必须单独真实验证。
- 风险：session/local browser storage 可被用户清理或禁用，故只能是偏好/恢复来源，不能是授权或数据正确性来源。

## 十七、AI 执行清单

### 17.1 执行前检查

1. 读取 `AGENTS.md`、`docs/index.md`、本 PRD；每阶段按场景只读需要的规范，先读 frontend/contracts/web-ui/architecture 和 verification。测试与权限阶段切换时再读对应规范，不一次预读全部。
2. 核对 `git status --short`，不得覆盖预存改动。
3. 搜索全部 TableView consumer、API routes/DTO/repository 和现有 generated client 调用，重新确认路径及调用面。
4. 将实现计划分前端/后端/共享契约/调用方/测试阶段；跨 `apps/api`、`apps/web`、`packages/shared` 属 L2，按 workflow 先列影响面。

### 17.2 分阶段任务

1. `packages/shared`：新增六个操作符和 sort direction 字符串 enum；运行 shared tests/typecheck。
2. `apps/api`：建受控通用 query definition/parser/executor；先为 users 实现 POST endpoint、权限与集成/行为测试；检查查询纯读和 200。
3. 导出 OpenAPI，执行生成 client；不得手写/提交生成目录。
4. `apps/web`：先实现 query/storage/column/action types 和纯函数，再实现 `createColumns`、option、`createTableQuery` 与回调；最后构建 toolbar、filters、sort、settings Drawer、selection/overlay、sticky layout。
5. 迁移其他四个资源端点和五个消费者，确保声明能力等于接口能力；summary 放 Query response meta。
6. 完成体验验证、全量关联 tests 和规范同步；核对所有旧 props、URL parser、每资源复制 serializer 都已移除。

阶段顺序可并行开发，但 API schema 必须在客户端消费者定型之前稳定；禁止先让 UI 显示未被 API 支持的能力。

### 17.3 禁止事项

- 禁止保留旧 API 或 props 兼容分支，用户已经确认一次性新契约。
- 禁止把搜索、筛选、排序、分页 query state 放 URL 或 IndexedDB。
- 禁止在每个 feature 重写六种操作符、日期或排序 serializer。
- 禁止把任意数据库字段或 ORM 查询对象从客户端传到后端。
- 禁止使用数组下标 row key；禁止把 checkbox 伪装成真实数据列。
- 禁止未声明/未实现的交互入口、空菜单项、没有行为的 action。
- 禁止把 server summary 写进 component state；禁止回调内重复发 query。
- 禁止在没有真实查询支持时本地假分页/排序来冒充 server capability。
- 禁止扩大为保存视图、分享、编辑器或跨页选择。

### 17.4 最终收口

报告实际改动路径、主要 API/行为、实际验证命令及关键输出、跳过/未验证项和遗留风险；检查 `git status --short`、`git diff --check`。不得把本 PRD 的目标状态写成现状或虚报测试通过。

## 十八、变更记录

| 日期       | 变更                                                        | 状态/依据                           |
| ---------- | ----------------------------------------------------------- | ----------------------------------- |
| 2026-11-15 | 将已确认的 TableView 交互和技术执行方案固化为唯一交接主文档 | 用户要求落地文档；治理依据 ADR-0035 |

### 实施补充（2026-11-15）

- [已确认] 查询键的实际前缀是 `['table-view', tableId]`；后续键包含身份、稳定 scope key 和完整条件。feature mutation 按此前缀失效。
- [已确认] `FilterKind` 在 Web 公开出口导出枚举；共享层保留无 React 依赖的纯条件模型和六种 `FilterOperator`、`SortDirection` 枚举。
- [已确认] 后端通用 builder/schema/plan 纯规则放 shared；安全 Prisma 条件和排序组装放 platform/table-query；字段能力仍在资源 DTO 声明。不会给每张表写一套 serializer。
- [已确认] 后端文本 contains/not_contains 对 PostgreSQL LIKE 的 `%`、`_` 和反斜线做字面转义，可空字段排序空值放末尾。用量金额用 Decimal 汇总，并在 RepeatableRead 同一快照查询 items/total/meta。
- [已确认] 动作回调携带 scope(view/row/bulk)、动作描述和固定 rowIds，成功回调可带 result；回调异常不改变动作成功/失败判定。
- [已确认] `flow` 模式按自然数据高度展开，跟随外层纵向滚动，标题和表头选择框追踪视区顶部；底栏不随横向滚动。
- [已确认] 未完成筛选草稿保留在编辑器内；有效文本筛选 300ms 防抖自动提交；移除“应用”按钮。排序 chip 的规则编辑器锚定 chip，所有字段选择器可搜索。
- [已确认] 列宽不因表格撑满而自动均分；剩余空间使用无语义 spacer，冻结 left 偏移与真实列宽一致，spacer 不进入列设置或拖拽。
- [已确认] 五个页面中已有创建/导入/导出入口归并到 toolbar.actions，不重复留在 Page.Header。
- [已确认] 本轮实施只包含本地代码与验证；产品复核和部署/发布必须分别记录，不将本地通过标记为已上线。

### 本地实施验收记录（2026-11-15）

- 源码及五个调用方已迁移；产品状态为待复核，未部署。
- API 全量测试含独立 cip_test 隔离 schema：226 项通过；Web 49 项通过；shared 25 项通过。全仓 typecheck、build、lint、docs/rules/protected 与空白检查通过；lint 保留一项 Promise void/BulkResult 类型风格 warning，不影响类型检查和退出状态。
- 真实页面已检查成员搜索/清除、多选与搜索互斥、状态筛选、角色类型投影筛选、排序选择/规则面板、列设置显隐/冻结、指针/键盘列重排、列宽拖动/双击恢复、每页条数/翻页和刷新恢复。
- 供应商、模型范围查询空态及用量 meta 汇总已在真实页面核对；CSV 下载和业务删除/停用未对现有业务数据实际执行，相关业务回调不属于破坏性浏览器验收。
- 850px 横向滚动：数据 scrollLeft=160，分页栏 x 不变；数据纵向 scrollTop=522.5 后 checkbox 仍居中于对应行。390px 视口 toolbar 高45px、footer高44px，页面无横向溢出。
- flow 模式通过临时本地验收页检查：数据自然高度1476px，外层纵向滚动后表头和全选框 y=52px，横向 scrollLeft=214 时 footer x 不变；临时页已移除。
- 浅/暗主题右侧列设置 Drawer 已检查；验收账号临时管理员角色已撤销，数据库剩余角色数0，管理页重新访问返回403。
- 检查器提示的3个疑似权限码候选均是测试 storage key/范围标签，不是产品界面文案，人工复核通过。
