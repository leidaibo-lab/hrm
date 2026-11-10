# 招聘协作 V1 发布说明

## 发布内容

部署 `apps/web`、`apps/api` 和 `packages/database` 的招聘协作首期版本，执行 Prisma migration `20261109185946_recruitment_baseline`。

## 发布前检查

1. 使用 Node 24、pnpm 10.6.0。
2. 配置 `DATABASE_URL`，执行 `pnpm db:deploy`。
3. 运行 API ready、Web smoke 和招聘 API 主流程。
4. 当前仅允许合成数据和模拟角色，不得导入真实候选人资料。

## 回滚

停止 Web/API 后回退应用 commit；数据库迁移不执行破坏性回滚，需按数据库变更评审后补充回滚脚本。生产发布和健康回执仍需外部平台确认。
