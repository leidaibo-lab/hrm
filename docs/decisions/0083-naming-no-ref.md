# ADR-0083 标识符禁用 Ref 命名并纳入机检

> 状态：已接受 · 日期：2026-11-17 · 级别：L3

## 问题

ADR-0044 已规定「禁止以 Ref 结尾的领域命名，外部对象映射用 Binding 或 Link」，但该约束只停在单条 ADR，未进入 `naming.md` 规则表，也没有机检；现状中 `GatewayModelRef`、`resolveRef`、草案中的 `credentialRef` 等命名持续出现，评审无法稳定拦截。

## 决定

1. 在 `docs/conventions/naming.md` 新增 `NAM-5.2`：标识符（函数/方法、类型、字段、参数、DTO 属性）禁止以 `Ref` 结尾，也禁止 `ref` / `refs` 作为独立标识符；外部对象映射用 `Binding` 或 `Link`，标识引用用 `Id` / `Key` / `Name`。Web 的 React `useRef` 局部变量不适用。
2. `scripts/checks/rules.ts` 增加 AST 检查：只扫描 `apps/api/src` 与 `packages/shared/src` 的声明位标识符，排除 `generated/`；不做全文正则，避免误伤 `useRef`、`refresh`。
3. `docs/reference/verification.md` 登记 `NAM-5.2`（enforcement=script，落点 `scripts/checks/rules.ts`）。
4. 存量 `configured-model-gateway.service.ts` 的 8 处命名同批改名：`GatewayModelRef` → `GatewayModelEntry`、`resolveRef` → `findGatewayModel`、局部 `candidateRef`/返回属性 `ref` → `candidateEntry`/`entry`。

## 被否决的选项

- **全文正则扫描 `ref`**：误伤 React `useRef`、`refresh`、`referral`，且无法区分声明与引用。
- **只靠 review**：ADR-0044 已有约定仍持续出现违规，说明人工拦截不可执行。
- **禁止所有包含 ref 的命名**：范围过大，与框架 API 冲突。
- **只改规范不加机检**：违反「规范必须可判定」的治理要求。

## 后果与回滚

- 新增 1 条规范、1 个检查块、1 行映射；首个批次即清零存量。
- 后续新增代码若使用 `XxxRef` 会在 `pnpm check:rules` 失败；第三方类型与 React ref 不受影响。
- 回滚：删除 `NAM-5.2`、`verification.md` 对应行与 `rules.ts` 检查块，并 revert 改名提交；无数据迁移依赖。
