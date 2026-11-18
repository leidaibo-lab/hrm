# ADR-0020 文档重切：按变更场景组织、拆分判据与规则可追踪

> 状态：已接受（规范效力与规则 ID 部分被 0023 取代） · 日期：2026-11-06 · 级别：L3

## 决定

1. **按变更场景重切现行文档 16 → 18 篇**：`architecture.md` 拆出 `contracts.md`（契约与路由）与 `persistence.md`（platform 与 Prisma）；`design.md` 改为 `web-ui.md`（删去页面原型、明确不做、认证页动效等非规范内容）；新增 `reference/architecture-overview.md`（收编根目录 `ARCHITECTURE.md`）；删除 `reference/context.md`（读取顺序并入 `AGENTS.md`，防幻觉并入 `boundaries.md`，探索顺序并入 `workflow.md` 推进循环）。
2. **确立拆分判据三条**并写入 `governance.md`：单场景（篇内 `##` 主题 ≤3）、单出处（一条规则只在一篇定义）、场景覆盖（一次生成动作除入口外 ≤3 篇，新建带权限模块 ≤5 篇）。
3. **规则可追踪**：规则采用稳定 ID（`<篇前缀>-<节>.<序>`），机器可判定规则 100% 登记到 `verification.md`「规则 → 检查映射」；无 enforcement 的规则视为未落地。
4. **元数据条款修正**：三元组要求从「前两行」改为「第 3 行（标题下第一个非空行）」，结构检查命令同步为可判定形式；篇数预算 16 → 18；新增「根目录不得存在未纳管文档」检查。
5. **提交信息规范**从 `documentation.md` 迁入 `process/workflow.md`；`process/boundaries.md` 吸收“事实确认（防幻觉）”四类信息表。
6. **机检补齐**：新增 `code-comments.spec.ts`（JSDoc 四类）、`docs-governance.spec.ts`（篇数 / 三元组位置 / 根目录游离文档 / 引用断链）；收紧 `architecture.spec.ts`（import 解析、跨模块 import、guard 命名、barrel 位置）与 `routes.spec.ts`（扫描非空守卫、OpenAPI summary 必填）；前端测试 `include` 扩到 `features/`、`app/`、`components/`；pre-commit 增加 `pnpm typecheck` 与 api 单测。

## 被否决的选项

- **保持 16 篇、只做内容归位**：`architecture.md` 仍会同时承载分层、契约、数据层三类读者，场景覆盖判据达不到（改接口仍被迫读 8 个主题）；放弃。
- **只加机检不改结构**：规则读不到的问题不解决，机检只能覆盖可机器判定的少数条款；放弃。
- **引入 openspec 作为变更级 spec/归档门禁**：当前阶段收益不足以抵消流程成本，且与既有 ADR 体系重叠；先以规则映射表 + 生成后 audit 清单替代，观察两个阶段后再评估。
- **把 `design.md` 的页面原型与明确不做移入 reference**：它们是产品愿景而非当前事实，放进描述层会继续污染事实源；直接删除，需要时由产品文档承接。

## 后果

- 现行文档 18 篇；`governance.md` 预算、`index.md` 清单、结构检查命令同步更新；`AGENTS.md` 只留读取顺序与指针。
- 引用迁移：约 30 处跨文档引用、三份目录清单合一（`index.md` 为唯一清单）。
- `design.md` 的认证页动效删除；`/login`、`/register` 的动效实现保留在代码中，不再作为规范。
- 规则映射表使“规范-检查”可审计；后续新增规则必须同时给 ID 与 enforcement，否则不予接受。
- 回滚：本次为独立提交，`git revert` 即完整还原；删除的 `context.md` 与根 `ARCHITECTURE.md` 可从 git 历史恢复（提交 12297b1 及之前）。

## 实施备注（2026-11-06）

- 已同步：`architecture.spec.ts` 收紧、`routes.spec.ts` 非空守卫与 summary 断言、`auth/session.guard.ts` → `auth/auth.guard.ts`、`apps/web` JSDoc 补全与 vitest include 扩容、42 处 JSDoc 明确违规清零、新增 `code-comments.spec.ts` 与 `docs-governance.spec.ts`、pre-commit 增加 typecheck 与 api 单测。
- 未落地（已在 `verification.md` 标注待落地）：OpenAPI diff 门禁、权限同步 / 缓存失效单测、函数与类型命名机检、DB 集成测试策略。
