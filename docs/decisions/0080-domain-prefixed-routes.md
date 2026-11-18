# ADR-0080 路由按领域前缀统一（API 与 Web）

> 状态：已接受 · 日期：2026-11-17 · 级别：L3

## 决定

API、Web 页面、导航与前端切片统一按**模块域名**做首段，前后端同名：

| 领域          | API 前缀                  | Web 页面                                                 | 前端切片                 | 导航 code         |
| ------------- | ------------------------- | -------------------------------------------------------- | ------------------------ | ----------------- |
| agentic       | `/api/v1/agentic/*`       | `/agentic/{tickets,threads,attention,console/*}`         | `features/agentic`       | `agentic.*`       |
| model-gateway | `/api/v1/model-gateway/*` | `/model-gateway/{providers,usages}`                      | `features/model-gateway` | `model-gateway.*` |
| iam           | `/api/v1/iam/*`           | `/iam/{users,roles,spaces,navigation,permission-points}` | `features/iam`           | `iam.*`           |

- 取消 Web 的 `/admin/*` 前缀；管理页与业务页同域，由权限点控制可见与可操作，不用路劲表达权限。
- 平台内部契约保留 `/api/v1/internal/*`；健康探针保留公开路径。
- 页面路由、导航 code、权限点资源命名三者同源；导航项 `path` 必须落在对应领域前缀下。

本决定取代 ADR-0048 中“agentic 页面不带领域前缀”的部分。

## 被否决的选项

- **只给 API 加领域前缀、Web 保持 `/tickets`**：前后端命名不一致，导航与权限资源难以对齐。
- **保留 `/admin/*`**：把“管理”当成领域，与权限模型重复，且 model-gateway/iam 的页面归属不清。

## 后果与回滚

- 现有路由与导航需同批迁移；旧路径可临时重定向一个版本，但文档与测试以新路径为准。
- 回滚：revert 本批提交并恢复 ADR-0048 路径；或保留新 API、只回退 Web 前缀（不推荐，会再次分叉）。
