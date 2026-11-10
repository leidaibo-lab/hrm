# 招聘协作实现交接

## 代码落点

- `apps/web/app/page.tsx`：招聘工作台、角色切换、候选人详情和操作表单。
- `apps/web/app/globals.css`：工作台视觉与交互状态。
- `apps/api/src/recruitment.controller.ts`：职位/候选人/筛选/面试/评价/决策 API。
- `apps/api/src/recruitment.types.ts`：前后端共享读模型契约。
- `packages/database/prisma/schema.prisma`：User、Position、Candidate、Screening、Interview、Evaluation、Activity。
- `packages/database/prisma/migrations/20261109185946_recruitment_baseline/migration.sql`：首期业务迁移。

## 设计与边界

采用状态机式状态守卫和事务式写入：状态变更与活动审计必须同事务提交；角色能力在 API 入口校验，前端按钮隐藏不作为安全边界；面试官读取联系方式时脱敏。数据库由 `packages/database` 所有，API 不创建第二套存储。

## 验证映射

| 需求 | 验证 |
| --- | --- |
| 页面与同源 API | `pnpm --filter @hrm/web build`、页面 smoke |
| 数据库模型 | `pnpm --filter @hrm/database generate/build`、Prisma migration |
| 招聘闭环 | API smoke：录入→筛选→初筛→面试→评价→录用 |
| 权限与脱敏 | 角色 overview API 与浏览器角色切换 |

当前不覆盖真实认证、外部接口、生产附件和跨实例并发；这些不属于本次已实现边界。
