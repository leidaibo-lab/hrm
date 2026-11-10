# 招聘协作 V1 测试回执

## 已执行

- PostgreSQL Compose 健康检查：通过。
- Prisma `recruitment_baseline` 迁移：通过。
- API 健康检查：`GET /api/health/ready` 返回 `{status: "ok", database: "ok"}`。
- API 主流程：候选人录入 → HR 筛选 → 负责人初筛 → 安排面试 → 面试评价 → HR 录用，最终状态为 `已录用`。
- Web 页面：Next.js 生产构建通过；同源 `/api/recruitment/overview` 可读取职位、候选人和活动。
- 浏览器 smoke：页面加载、角色选择和候选人看板可见。

## 未覆盖

真实账号、真实简历、飞书/Boss 接口、生产部署、附件治理、多实例并发和完整浏览器回归尚未验收。
