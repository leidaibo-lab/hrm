# 数据与基础设施规范

> 层：规范 · 时态：约束未来 · 失效：存储选型或 Prisma 纪律变更时

## 目的

承载**数据层与进程级技术能力**的约束：`platform/` 边界、Prisma model 与迁移纪律、mapper 联动、审计落点。接口形态见 `contracts.md`，模块分层见 `architecture.md`。

## 何时读取

- 修改 `apps/api/prisma/schema.prisma`、新增迁移、调整 mapper。
- 新增 `platform/` 能力或外部系统客户端（队列、对象存储、HTTP、加解密）。

## 技术能力（platform/）

1. `platform/` 只放**进程级技术能力**：数据库（Prisma）、缓存与锁（Redis）、队列（BullMQ）、对象存储（S3 兼容）、HTTP 客户端、加解密（AES-256-GCM）。它不是 DDD 的端口实现——端口实现一律在模块 `infrastructure/`。
2. 业务模块必须经注入的 platform 服务访问外部能力，禁止自建客户端或连接。
3. 新增技术能力先落 `platform/<能力>/`（module + service + barrel），再被模块消费；子域外只经 barrel 导入。
4. 模型网关属业务域能力，落模块 `infrastructure/`（ADR-0015）。
5. 实时通道：流式输出必须用 SSE；双向实时（在线状态等）才可用 Socket.IO。

## 数据访问

1. 表结构、字段、约束与索引的唯一规则见 database.md；业务模块必须经注入的适配器访问数据，raw SQL 必须封装并参数化。
2. 查询必须限定资源范围、字段投影、分页上限和稳定排序；禁止循环查库形成 N+1、详情通过全量列表查找或无界导出。外部只读目录代理源（上游仅提供单一全量端点，如 models.dev `api.json`）豁免：经全量响应内查找属上游接口形态，非存储 N+1。
3. 写入必须白名单字段；禁止把请求对象整体展开入库；省略、清空和更新必须保持契约语义。条件更新必须检查受影响行数。

## mapper 与审计

1. mapper 负责持久化与领域转换；schema 变更必须审查迁移、查询、mapper、实体、读模型与 HTTP 消费方；实体不出模块。 `PER-5.1`
2. 审计由 `pipeline/audit/` 统一落 `audit` 表，业务 model 不复制审计列。

## 一致性

1. 应用服务必须明确原子操作范围，基础设施在具体端口中实现事务；事务句柄禁止进入 domain。外部网络请求必须在数据库事务外完成。
2. 模型与初始价格必须逐项原子写入；重复项只在数据库约束确认同一注册时跳过。详情禁止通过全量列表查找；时间条件必须按操作构建。
3. 当前角色、供应商和模型不采用通用 version 乐观锁；角色按基本信息/权限的修改意图分别保存。同一字段并发写入以后提交为准，不承诺陈旧编辑冲突检测。验证：单元测试、按需隔离 DB 测试与人工审查。

## 迁移流程

1. migration 必须经 prisma migrate 生成；已应用或已进入目标基准的迁移禁止修改或删除，修正必须新增迁移。 `PER-4.2`
2. 增加必填/唯一、缩小类型和删除字段必须评审已有数据、回填、锁表与新旧应用兼容；高风险变更应该分增加、回填、切换和清理阶段。
3. 回填必须分批、可恢复、可重试并核对总量；数据库升级必须分别验证空库重放与已有数据升级，应用回退不等于数据恢复。
4. schema 变更 → 迁移命令见 `../reference/verification.md`「命令注册表」；前置条件（docker compose、`.env`）同表。
5. 迁移与 seed 的命令状态以 `verification.md` 注册表为准，不得在文档中复制命令。

## 验证方式

- `architecture.spec.ts`：`platform/` 禁止 import `modules/`，`domain/` 禁止 `@prisma/client`。
- `prisma validate`：schema 必须可解析；model / `@@map` 命名策略人工核对。
- 迁移评审走 `review`：已应用迁移只增不改；schema 变更必须同步 mapper。
- `prisma validate` / `migrate` 状态见 `../reference/verification.md`。
