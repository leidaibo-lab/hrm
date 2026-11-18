# ADR-0082 数据前缀非空、Space 归属 iam、model-gateway 上下文登记

> 状态：已接受 · 日期：2026-11-17 · 级别：L3

## 决定

1. **所有上下文登记前缀非空**：`audit_`、`iam_`、`model_gateway_`、`agentic_`；不再允许“无前缀”上下文。
2. **Space / SpaceMember / RoleAssignment 归属 iam**：表 `iam_spaces`、`iam_space_members`、`iam_role_assignments`；业务域只存 `spaceId`，不复制可见性事实源。
3. **model-providers 改名为 model-gateway**：上下文登记为 `model-gateway`（前缀 `model_gateway_`），模块与页面同名前缀；不使用缩写 `model_`，避免与平台模型概念混淆。
4. 跨上下文只用标识引用，不做跨 schema / 跨模块外键；Mastra 表留在独立 `mastra` schema。
5. 表改名用显式 `ALTER TABLE ... RENAME TO` 迁移，禁止依赖自动 diff 的 drop/create。

## 被否决的选项

- **保留 iam/model 无前缀**：与“表名带领域前缀”的目标冲突，也无法从表名判断归属。
- **agentic 独立 schema**：DB-4.2 用前缀表达归属，独立 schema 需改规范且收益不足。
- **Space 留在 agentic**：访问边界属于身份与访问域，留在业务域会形成第二套权限事实源。

## 后果与回滚

- 存量表需改名与迁移，Prisma `@@map`、检查设施、文档同批更新。
- 回滚：恢复旧前缀与 Space 归属需逆向迁移；跨域外键与非空前缀约束需同步回退。
