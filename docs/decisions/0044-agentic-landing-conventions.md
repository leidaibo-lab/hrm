# ADR-0044 agentic 落地命名与文档约定

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

为承载 ADR-0042 与 ADR-0043，落地时统一以下命名与文档约定。

### 命名

- **数据表**：物理表统一 `agentic_` 前缀，model 保持 PascalCase 单数，枚举同前缀映射；字段保持 camelCase。
- **执行目录**：用 `infrastructure/runtime/` 表达职责，不用框架名 `mastra` 作目录名；框架名只出现在 import 与依赖声明中。
- **连接器**：使用 `lark`，不使用 `feishu`；禁止以 `Ref` 结尾的领域命名，外部对象映射用 `Binding` 或 `Link`。
- **新增命名角色**：在既有 18 项角色表外新增 `agent`、`workflow`、`tool`、`scorer` 四项，**仅允许**出现在 `modules/*/infrastructure/runtime/` 下；新增角色按 `NAM-4.1` 同步更新角色表、白名单测试与本 ADR。
- **前端**：`features/<domain>/<feature>/` 分组，域名目录不设 `index.ts`，出口仍在 feature 层；路由段仍与 API 资源同源，不出现领域名。

### 文档

- **目录式 PRD**：`docs/prd/<domain>/index.md` 为主 PRD，`docs/prd/<domain>/<topic>.md` 为专题规格。
- **两类章节**：主 PRD 保持模板 18 节完整；专题规格固定 8 节（文档信息、范围与非目标、现状与约束、设计、接口与数据、验收标准、风险与开放问题、变更记录）。
- **单一真相**：领域模型、表结构、连接器契约各只在对应专题写一次，主 PRD 只引用不复制。
- **模型配置**：模型由页面配置并按角色解析（`fast` / `main` / `judge`），PRD 只定义可配置项，不写死具体型号。
- **密钥**：配置表只存引用，密钥经 `platform/crypto` 管理，不进入配置 JSON 与提示词。

本 ADR 取代 ADR-0029 中关于扁平 PRD 与单一文件形态的条款；PRD 目录、文件名与章节校验的具体条文，随 `docs/conventions/documentation.md` 修订生效。

## 被否决的选项

- **继续扁平 PRD 加前缀**：域一多，`docs/prd/` 会变成几十个平铺文件，导航与归属都差。
- **保留 `mastra` 目录名**：把供应商写进路径，替换框架即产生无意义的重命名。
- **把四个新角色并入通用角色表**：会放宽全仓命名约束；限定在 `runtime/` 下才能控制影响面。
- **PRD 写死模型型号**：页面可配置后必然过期，且会让执行方误以为不可替换。
- **子目录 PRD 先建后补校验**：未纳入检查的文档会静默漂移。

## 后果与回滚

生效前必须完成三处同步，否则目录式 PRD 与新增角色处于“未校验”状态：

1. `docs/conventions/documentation.md`：新增两类 PRD 与目录结构条文，修订 `DOC-3.2`、`DOC-3.3`。
2. `scripts/checks/docs.ts`：PRD 检查支持一层递归；`index.md` 按 18 节校验，专题规格按 8 节校验。
3. `docs/index.md`：PRD 清单按域登记。

回滚：恢复扁平 PRD 与旧目录命名，移除四个新增角色及其白名单，删除对应 ADR；已产出的 PRD 用 `git mv` 迁回并保留版本记录。
