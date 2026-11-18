# ADR-0021 application 与 infrastructure 解耦

> 状态：已接受 · 日期：2026-11-06 · 级别：L3

## 决定

1. 模块 `application/` 禁止 import `infrastructure/` 具体实现。外部能力经 domain 端口取得：`domain/*.repository.ts`（持久化）与 `domain/*.port.ts`（外部系统集成）+ 注入令牌；`<域>.module.ts` 作为组合根，是唯一同时 import 两层并 `useClass` 绑定实现的文件。
2. `application/` 同时禁止 import `dto/` 与 `pipeline/`：DTO 映射在 controller，请求上下文类型不进应用层。
3. `architecture.spec.ts` 扩展为分层依赖边界检查（ARC-5.2 / 5.3 / 5.5 / 5.6），覆盖全部业务模块；auth / iam / model-providers 全量通过。
4. 需要第三方 SDK 类型的端口用类型参数把具体类型交给 application 绑定（`ModelGatewayPort<TGateway, TModel>`），domain 不 import `@mastra/*`。
5. `model-providers` 落地：`CatalogPort`（models.dev 目录，infrastructure 返回读模型，application 不映射 DTO）与 `ModelGatewayPort`（mastra 网关快照 + 模型解析）。
6. 跨域 ACL 允许 `infrastructure/` 调对方导出的 application Service（auth → iam 用户查询），禁止直查对方存储；机检按 ARC-5.4 放行。
7. `CallContextInterceptor` 从模块 `infrastructure/gateway/` 迁入 `pipeline/call-context/`，由 `app.module.ts` 全局注册，路由用 `@CallContextCaller()` 标注；接入层不再 import infrastructure。

## 被否决的选项

- type-only import + token：运行时解耦但源码仍依赖 infra 类型，机检无法区分。
- 端口定义在 application：需新增 application 白名单位置（`*.port.ts`），与 domain 端口并存形成两套来源；本轮不引入，必要时另立 ADR。
- 维持现状：application 直接依赖具体实现，与 ADR-0014 的分层声明不一致。

## 后果

- application 对 infrastructure 的 import 归零；infrastructure 依赖 domain 端口。
- `ModelsDevClient` 返回 domain 读模型；`CatalogService` 返回读模型，由 controller 映射 DTO。
- 网关端口用泛型参数承载 mastra 类型：这是「domain 不 import SDK」的既定手法，新增同类端口需在 ADR 层记录，不得扩散。
- `importModels` 目前无调用方，本次只改类型不删除。
- 回滚：单次 revert；无外部契约变更，OpenAPI 不变。
