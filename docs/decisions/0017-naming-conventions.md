# ADR-0017 api 命名规范：封闭角色表与目录白名单

> 状态：已接受 · 日期：2026-11-06 · 级别：L3

## 决定

`apps/api/src` 统一命名规范，规则正文见 `docs/conventions/naming.md`：

1. 文件命名模型 `<resource>[.<technology>].<role>.ts`，角色取 **18 项封闭表**（module / controller / dto / service / entity / repository / port / mapper / guard / interceptor / pipe / filter / decorator / error / type / helper / spec / fixture）。
2. 删除旧后缀：`provider`（Nest 泛称，改 `.service.ts`）、`projection`（接口含写方法，按 DDD 用 `.repository.ts`）、`client/gateway/factory/limiter/metering/store`（技术能力进文件名前缀，角色用 `service`/`helper`）、`exception-filter`（用 `.filter.ts`）。
3. 函数/方法采用封闭动词表（`get/find/list/exists/probe/create/update/set/save/remove/assert/ensure/must/to/build/resolve/apply/is/has/can/on`）。
4. 机器校验：`src/__tests__/architecture.spec.ts` 按目录断言文件名白名单与依赖方向。

## 被否决的选项

- 保留 23 项表（把 `client/gateway/factory/limiter/metering/store` 当角色）：技术能力无限增长，每加一种能力就加后缀，正是本次要消除的蔓延。
- 保留 `projection`：接口有 `create/activate/deprecate/upsertSummary` 写方法，按 DDD 就是 repository；且 ADR-0014 B.2 已规定读模型留在 repository 接口内。
- 只加测试不写规范：规则不可阅读，无法指导新域。
- 维持无后缀白名单：白名单随域增长，等价于没有约束。

## 后果

- 约 20 个文件重命名、45 处符号改名、14 处 getter 收敛为裸名词（私有字段改 `#`）；行为与契约不变。
- `docs/` 新增 `naming.md`（篇数 15→16），`architecture.md` 删除命名条目、只保留指向。
- 新增业务域复用角色表；新增 `platform` 能力或 `pipeline` 机制只新增目录，不扩表。

## 补充（2026-11-06）

`domain/` 白名单收紧为 `.entity.ts` / `.repository.ts` / `.port.ts` / `.error.ts`：领域层禁止 `helper` / `type`。原 `permission-expand.helper.ts` 收敛为 `PermissionSet` 值对象（`.entity.ts`），理由与正文一致——`helper` 是无角色兜底词，放进领域层会重演"每域新增后缀"的蔓延。
