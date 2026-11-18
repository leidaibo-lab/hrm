# ADR-0050 agentic 来源授权记录与接入校验

> 状态：已接受 · 日期：2026-11-16 · 级别：L3

## 决定

补齐 `security.md` §4.6 的来源授权链：群管理员授权 → 记录（群/范围、授权人、时间、有效期）→ 到期/撤销失效 → 接入时校验。

- **数据模型**：新增 `agentic_source_authorizations`（`sourceInstanceId + scopeKey` 唯一，关联来源实例级联删除，记录 `authorizedBy/expiresAt/revokedAt/createdAt`），V0 表数 21→22。
- **校验**：`IngressService` 在适配器范围判定后、落库前校验；授权记录存在但过期/撤销则拒绝（`unauthorized`），不再读取。**迁移兼容**：实例尚无任何授权记录时沿用旧配置白名单，避免上线即断流；首个授权记录写入后即强制校验。
- **管理接口**：`GET/POST/DELETE /connector/sources/:id/authorizations(/:scopeKey)`，权限沿用 `source:configure`，审计 `source.authorize` / `source.revoke`。
- **检查设施**：新增 controller/端点会改变权限矩阵快照与端点审计清单，按本 ADR 更新 protected 基线。

## 被否决的选项

- **不建表、只靠配置白名单**：无法表达授权人、有效期与撤销，也无法满足「撤销后下一分钟停止处理」。
- **要求所有实例立即迁移到授权记录**：会导致存量实例停流；采用「零记录兼容、写入即强制」的渐进路径。
- **新增权限点**：来源授权属来源管理，沿用 `source:configure` 足够，避免权限目录膨胀。

## 后果与回滚

- 授权/撤销在接入路径即时生效；每个事件会多一次授权查询（V0 可接受，后续可缓存）。
- 到期即失效，不需要定时任务；撤销幂等。
- 回滚：删除表/端点/Ingress 校验与 env 无关，恢复旧白名单路径；已写入授权记录保留。
