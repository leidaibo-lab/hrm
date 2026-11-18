# ADR-0057 agentic 关注必填等待对象与时限

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

落地 `domain.md` I9 与 `security.md` §4.8：每条关注意义上都必须有人可等、有期限可催。

- **数据库**：`agentic_attentions.assignee` 与 `deadline` 改为 `NOT NULL`；迁移 `20261116210000_attention_required`。
- **存量回填**：`assignee` 回落到工单关联 Mandate 的 `actorId`（授权发起人）；`deadline` 回落到 `createdAt + 72h`。两者都在同一条迁移内完成后再收紧约束。
- **应用层**：`Attention.create` 拒绝空等待对象与非法时限；`AttentionService.ask` 在调用方未给值时，先取显式值，再回落到工单授权发起人；仍为空则拒绝创建。未显式给时限时默认 72 小时。
- **调用方**：澄清、拆解、停滞升级、运行失败转人工与出站永久失败都在创建时传入或解析等待对象；升级/失败路径优先策略负责人，缺失时回落到授权发起人。

## 被否决的选项

- **`unassigned` 占位符**：满足非空但不满足「有人可等」，会把配置缺失藏进数据。
- **保持可空、只在页面提示「未指定」**：I9 仍未落地，逾期扫描与升级路径无法保证有对象。
- **删除空值存量关注**：丢失已发生的等待与决策线索，不可接受。

## 验证

2026-11-16 在隔离库 `cip_mig_check_20261116`（新建后已删除）执行：

- `prisma migrate deploy` 全部 13 个迁移成功；`information_schema` 显示两列 `is_nullable = NO`。
- 事务内回填演练：插入 `assignee/deadline` 均为空的存量关注后执行迁移 SQL，结果为 `assignee = ou-requester`、`deadline - createdAt = 72h`。
- 以 `NULL` 写入两列分别被数据库拒绝：`violates not-null constraint`。

本地业务库 `cip` 的迁移历史与仓库不一致（含一条已不存在的迁移），未对其执行迁移；验证只使用隔离库。

## 后果与回滚

- 授权发起人缺失时创建关注会失败并进入运行失败/告警路径，而不是静默产生无人承接的等待对象。
- 回滚需同时回退代码与 `ALTER COLUMN ... DROP NOT NULL`；已回填数据保留，不回滚。
- 默认 72 小时只覆盖未显式给时限的调用方；升级类关注仍按各自 24 小时时限写入。
