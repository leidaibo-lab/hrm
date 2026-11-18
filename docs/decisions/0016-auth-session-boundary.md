# ADR-0016 auth 会话边界：撤销存储豁免，按标准分层落地

> 状态：已接受 · 日期：2026-11-06 · 级别：L3

## 决定

撤销 P2 迁移提交 `cc68bd4` 中「会话存储不建伪端口」的防退化记录，auth 会话链路按 ADR-0014 标准形态落地：

1. **会话存储标准分层**：`domain/session.repository.ts`（`SessionRepository` 端口 + `SESSION_REPOSITORY` 令牌）+ `infrastructure/redis-session.repository.ts`（Redis 实现：键设计 `auth:session:{sid}` / `auth:user-active:{userId}`、TTL、单设备互踢写序、payload zod 校验全部内聚实现内，为端口契约）；`application/session.service.ts` 保留为薄编排（薄转发为 ADR-0014 既定成本），公开签名不变。会话键与 payload 解析全仓单源于该实现。
2. **认证域不直查他域聚合存储**：`LocalPasswordProvider` 改经 iam 导出的 `UserService` 认证支撑面（`findAuthByUsername` / `existsByUsername` / `existsByEmail` / `create`，ADR-0010：注册建号无角色无权限），auth 模块自此零 Prisma 依赖；iam 的 `UserRepository` 端口相应扩展 `UserCredentialView`（含 passwordHash 敏感列，仅供认证链路）与四个方法。
3. **guard 归位与 cookie 传输边界**（承前稿，不变）：SessionGuard 落 `modules/auth/`（原 common/guards），身份与权限经 iam 导出服务读取；cookie 写入与清除收口 controller，应用服务不接收 express `Response`。

豁免清单回到三条：health 模块豁免（ADR-0014）、模型网关落模块 infrastructure（ADR-0015）、CQRS-lite 读模型直返（ADR-0014 附录 B.2）——auth 不再有形态豁免。

## 被否决的选项

- 维持会话直连 Redis（原豁免立场）：持久化知识错层住进应用层，「知识无家可归」已被证实过一次——SessionGuard 曾在 common 平行实现键设计与 payload 解析（漂移实锤）；且 auth 是 iam / model-providers 之外唯一形态异类，与 ADR-0014「为一致性支付薄转发税」的决策偏好矛盾。
- LocalPasswordProvider 继续直查 Prisma user 表：auth infrastructure 越域摸 iam 聚合存储，绕过域导出面；iam 聚合的实体方法纪律与 mapper 被旁路。
- 互踢策略上移应用层：互踢本质是「读索引 → 删旧 → 写新 → 写索引」的存储时序，与键设计不可分割；拆到应用层需端口暴露原语操作，接口反而泄漏。

## 后果

- auth 模块形态与 iam / model-providers 完全一致（domain port + infrastructure 实现 + application 薄编排）；iam 导出面新增认证支撑段（.UserService 4 方法）。
- `UserRepository` 端口扩 4 方法，实现与测试替身同步；api 测试 64 → 68 例（互踢 5 例迁仓储级、会话委托 +1、认证支撑 +3）。
- 契约不变：端点、schema、cookie 属性、401/409 语义与文案全部不变（OpenAPI 三方 diff 为空已验证；登录/互踢/register 建号/重复用户名 409/登出/401 全分支冒烟通过）。
- 回滚：revert 单次提交即完整还原（无数据迁移、无契约变更）。
