# HRM 项目协作规则

## 基本要求

- 使用中文沟通、记录产品决策和项目说明。
- 开始任务前先检查 `git status --short`、`git diff --stat`、`git diff --name-status`，通过变更确认当前上下文。
- 不覆盖、不回退与当前任务无关的已有修改。
- Git 提交信息遵守 `type(scope): message`，例如 `docs(product): 记录 HRM 产品探索结论`。

## 产品工作流

产品探索阶段优先使用已安装的 `phuryn/pm-skills` 插件：

- `pm-product-discovery`：用户、问题、机会、假设和实验。
- `pm-product-strategy`：定位、价值主张、竞品和产品战略。
- `pm-market-research`：用户画像、细分、用户旅程和反馈分析。
- `pm-execution`：PRD、用户故事、验收标准、路线图和测试场景。
- `pm-data-analytics`：HR 指标、SQL、留存和实验分析。
- `pm-ai-shipping`：AI 生成代码的权限、安全、性能和测试覆盖审查。

### 工作流入口

- 你是有个新点子，但不知道有没有价值？那先走 `/discover`。
- 你心里有方向，但战略还模糊？那就走 `/strategy`。
- 你准备推进落地，需要把需求说清楚？那就 `/write-prd`。
- 你快要面向市场了，发布动作没串起来？那就 `/plan-launch`。
- 你做了一堆事情，却没有一个能对齐团队的核心指标？那就 `/north-star`。

## 阶段门禁

1. 产品发现结论确认前，不进入技术方案和业务代码实现。
2. MVP 范围确认前，不建立正式数据库模型和接口契约。
3. 涉及员工档案、身份证件、合同、薪酬和绩效等敏感数据时，必须单独记录权限、审计和数据生命周期要求。
4. 每一项功能都要明确目标角色、业务价值、成功指标和验收标准。

## 文档路由

- `README.md`：项目定位和当前阶段。
- `docs/product/README.md`：产品探索文档索引。
- `docs/product/`：产品发现、策略、PRD、指标和决策记录。
