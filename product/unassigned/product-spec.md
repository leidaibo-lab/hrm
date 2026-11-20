# 产品规格

**一、产品任务总览**

- TASK-PRODUCT-OVERVIEW: 形成 HRM 招聘协作闭环一期的目标、用户、价值主张、范围、非目标和成功指标，使研发、设计和测试能够理解本期交付边界 | 需求: REQ-SCOPE-FEISHU-BOUNDARY, REQ-TRIAL-CLOSURE, REQ-NON-GOAL-PERFORMANCE
- TASK-SCOPE-BOUNDARY: 明确飞书、Boss 直聘和 HRM 在招聘流程中的职责边界，并在产品页面和流程说明中体现承接点 | 需求: REQ-SCOPE-FEISHU-BOUNDARY, REQ-POSITION-CREATE
- TASK-ROLE-MODEL: 建立账号、系统角色、组织归属和职位责任的独立业务模型 | 需求: REQ-ACCOUNT-ROLE, REQ-POSITION-RESPONSIBILITY
- TASK-PERMISSION-MATRIX: 输出 HR、用人负责人、面试官和管理员对职位、候选人、面试、评价及决策的访问和操作矩阵 | 需求: REQ-AUTH-POSITION, REQ-AUTH-BYPASS, REQ-ADMIN-AUDIT
- TASK-POSITION-ONBOARDING: 支持 HR 将飞书已发布职位录入 HRM，并维护职位基础信息、招聘状态和责任人 | 需求: REQ-POSITION-CREATE, REQ-POSITION-RESPONSIBILITY
- TASK-CANDIDATE-ENTRY: 支持有权限的 HR 手工录入候选人、关联职位并保存简历 | 需求: REQ-CANDIDATE-CREATE, REQ-CANDIDATE-REQUIRED, REQ-CANDIDATE-JOB-LINK
- TASK-CANDIDATE-DUPLICATE: 为候选人录入提供疑似重复提示，并根据确认后的规则处理后续操作 | 需求: REQ-CANDIDATE-DUPLICATE
- TASK-CANDIDATE-DETAIL: 提供候选人统一详情，集中展示资料、简历、状态、负责人、筛选、邀约、面试、评价、决策和操作记录 | 需求: REQ-CANDIDATE-STATUS, REQ-OUTREACH-RECORD, REQ-DECISION-AUDIT, REQ-STATUS-AUDIT
- TASK-CANDIDATE-STATUS: 建立候选人招聘阶段状态及状态变化记录，支持从录入到最终决策的过程追踪 | 需求: REQ-CANDIDATE-STATUS, REQ-STATUS-AUDIT
- TASK-HR-SCREENING: 支持 HR 对候选人进行筛选、填写结果并推荐给用人负责人 | 需求: REQ-HR-SCREEN
- TASK-MANAGER-SCREENING: 支持用人负责人查看推荐候选人并提交初筛结果、原因和下一步状态 | 需求: REQ-HIRING-MANAGER-SCREEN, REQ-SCREEN-REASON
- TASK-OUTREACH-LOG: 支持 HR 记录外部联系和邀约结果，并将记录纳入候选人时间线 | 需求: REQ-OUTREACH-RECORD
- TASK-INTERVIEW-SCHEDULE: 支持 HR 创建多轮面试、指定面试官并维护面试基础信息 | 需求: REQ-INTERVIEW-CREATE, REQ-INTERVIEW-INFO
- TASK-INTERVIEW-STATUS: 根据面试计划时间维护待进行、进行中、已结束、已取消和已逾期等面试状态 | 需求: REQ-INTERVIEW-INFO, REQ-INTERVIEW-OVERDUE
- TASK-INTERVIEW-EVALUATION: 支持指定面试官查看本人面试任务并提交评价，形成评价状态和提交记录 | 需求: REQ-INTERVIEW-EVALUATION, REQ-EVALUATION-PENDING, REQ-EVALUATION-AUTHORITY, REQ-EVALUATION-COMPLETE
- TASK-RECRUITMENT-DECISION: 支持有权限的责任人提交录用、淘汰或暂缓结果，并保存决策原因和历史 | 需求: REQ-DECISION-SUBMIT, REQ-DECISION-REASON, REQ-DECISION-STATUS, REQ-DECISION-AUDIT
- TASK-WORKBENCH-TODO: 根据当前用户权限展示待初筛、待评价、待决策、逾期面试和长期未推进候选人 | 需求: REQ-DASHBOARD-PERSONAL, REQ-DASHBOARD-TODO, REQ-LONG-STAGNATION
- TASK-WORKBENCH-ACTION: 为每条工作台待办提供到业务对象和处理动作的可用入口 | 需求: REQ-DASHBOARD-LINK
- TASK-LONG-STAGNATION: 根据确认后的时间阈值识别没有有效推进动作的候选人，并在工作台及候选人列表中标识 | 需求: REQ-LONG-STAGNATION
- TASK-AUTHORIZATION: 对页面访问、业务对象读取、业务对象修改和敏感字段访问执行一致的权限判断 | 需求: REQ-AUTH-POSITION, REQ-AUTH-BYPASS
- TASK-ADMINISTRATION: 支持管理员维护账号、角色、组织和基础配置，并记录维护操作 | 需求: REQ-ACCOUNT-ROLE, REQ-ADMIN-AUDIT
- TASK-SENSITIVE-DATA: 对简历、联系方式、面试评价和招聘决策执行访问、下载、修改、删除和审计控制 | 需求: REQ-SENSITIVE-RESUME, REQ-AUTH-POSITION
- TASK-AUDIT-TRAIL: 建立候选人、面试、评价、决策和职位责任变化的操作时间线 | 需求: REQ-DECISION-AUDIT, REQ-STATUS-AUDIT, REQ-ADMIN-AUDIT
- TASK-FAILURE-HANDLING: 对保存失败、权限拒绝、必填缺失、疑似重复和无效状态推进提供可观察反馈 | 需求: REQ-CANDIDATE-REQUIRED, REQ-CANDIDATE-DUPLICATE, REQ-AUTH-BYPASS, REQ-SAVE-FAILURE
- TASK-TRIAL-ACCEPTANCE: 使用技术部前端招聘试点数据验证候选人从录入、筛选、邀约、面试、评价到最终决策的完整闭环 | 需求: REQ-TRIAL-CLOSURE
- TASK-METRICS-DEFINITION: 建立候选人流程完整率、评价提交率、逾期面试、长期未推进、有责候选人比例和决策记录完整率的统计口径 | 需求: REQ-DASHBOARD-TODO, REQ-LONG-STAGNATION, REQ-DECISION-AUDIT, REQ-TRIAL-CLOSURE

**二、模块产品规格**

**2.1 账号与权限模块**

作用对象：用户账号、系统角色、组织和职位责任。

关键条件：

- 账号、系统角色和职位责任分开配置。
- 业务数据权限必须结合职位责任判断。
- 管理员维护权限不自动等于招聘决策权限。
- 未确认的权限范围不得由界面默认扩大。

可观察交付结果：

- 管理员可以维护用户和角色。
- 职位可以配置招聘 HR、用人负责人和面试官。
- 用户只能访问其权限范围内的业务数据。
- 越权请求被拒绝且不泄露敏感字段。
- 权限变更保留操作记录。

**2.2 职位承接模块**

作用对象：飞书已发布职位。

关键条件：

- 职位在飞书完成发布后，才进入 HRM 招聘协作范围。
- 一期支持人工录入。
- 职位必须明确招聘 HR 和用人负责人，除非产品负责人确认其他规则。

可观察交付结果：

- 职位列表展示职位名称、部门、招聘状态、责任人和候选人数量。
- 职位详情可进入候选人协作流程。
- 已关闭或暂停招聘的职位不能继续执行未授权的流程动作。

**2.3 候选人模块**

作用对象：候选人、简历及候选人与职位的关联关系。

关键条件：

- 候选人通过人工录入进入系统。
- 候选人必须关联职位。
- 候选人详情聚合招聘过程信息。
- 重复候选人规则需要产品负责人确认。

可观察交付结果：

- HR 可录入候选人并关联简历。
- 系统对疑似重复进行提示。
- 候选人详情可查看当前状态、负责人、操作记录和下一步动作。
- 保存失败不会生成虚假的成功结果。

**2.4 筛选与推荐模块**

作用对象：HR 筛选记录和用人负责人初筛记录。

关键条件：

- HR 先完成筛选，再推荐给用人负责人。
- 用人负责人只能处理本人负责职位内的推荐候选人。
- 初筛结果和原因需要进入候选人记录。

可观察交付结果：

- HR 可以完成筛选并提交推荐。
- 用人负责人工作台出现待初筛事项。
- 用人负责人提交结果后，候选人状态和时间线同步更新。

**2.5 外部邀约模块**

作用对象：HR 与候选人的外部联系记录。

关键条件：

- 一期不接入 Boss 直聘或外部消息。
- HR 手工记录联系和邀约结果。
- 记录应保留时间、方式、结果和下一步计划。

可观察交付结果：

- HR 可以新增、查看和修改有权限的邀约记录。
- 候选人详情按时间顺序展示邀约记录。
- 邀约记录不会被零散消息替代或隐藏。

**2.6 面试与评价模块**

作用对象：面试安排、面试官和面试评价。

关键条件：

- HR 创建面试并指定面试官。
- 面试官只处理被分配给自己的面试。
- 面试和评价具有独立状态。
- 评价未提交时，系统必须能识别待办。

可观察交付结果：

- 面试官在工作台看到本人待面试和待评价事项。
- 面试结束后，未提交评价的任务显示为待提交。
- 提交评价后记录提交人、提交时间和评价内容。
- 未被指定的用户不能提交该面试评价。
- 满足确认后的时间条件时，面试显示为逾期。

**2.7 招聘决策模块**

作用对象：最终招聘决策和候选人结果。

关键条件：

- 只有确认后的决策责任人可以提交结果。
- 决策必须包含结果、决策人、时间和原因。
- 修改决策必须保留历史。

可观察交付结果：

- 决策人可以提交录用、淘汰或暂缓。
- 缺少必要原因时无法提交。
- 候选人状态与决策结果一致。
- 查看候选人时间线可以还原决策变化。

**2.8 工作台模块**

作用对象：当前登录用户的待办和异常事项。

关键条件：

- 工作台按个人权限展示。
- 待办必须能够跳转到具体业务对象。
- 长期未推进阈值和面试逾期口径需要确认。

可观察交付结果：

- HR 看到待筛选、待邀约推进、待面试安排和长期未推进候选人。
- 用人负责人看到待初筛和待招聘决策事项。
- 面试官看到待面试和待评价事项。
- 逾期和长期未推进事项具有明确标识。
- 点击待办后可以执行当前用户有权执行的动作。

**三、字段与规则待定清单**

以下内容需要在正式研发前由产品负责人确认：

- 职位字段的必填范围。
- 候选人字段的必填范围。
- 简历允许的文件类型、大小、版本和下载规则。
- 手机号、邮箱等重复判断字段。
- 一个候选人是否允许关联多个职位。
- 候选人是否允许跨职位流转。
- 状态是否允许跳过、回退、取消和重新打开。
- 面试轮次是否允许删除、插入或调整。
- 面试逾期具体按计划结束时间、计划开始时间还是其他规则判断。
- 长期未推进按最后状态变化时间、最后沟通时间还是最后任一业务动作时间判断。
- 暂缓和淘汰是否必须填写原因。
- 管理员是否可以代办业务动作。
- 决策是否支持多人确认。
- 简历和评价的保存期限。
- 候选人停用、删除、匿名化和导出规则。
- 指标统计周期和目标值。

**四、建议的上线顺序**

- TASK-FOUNDATION: 先完成账号、角色、职位责任和职位承接规则，形成可控的数据访问边界 | 需求: REQ-ACCOUNT-ROLE, REQ-POSITION-RESPONSIBILITY, REQ-AUTH-POSITION
- TASK-CANDIDATE-FLOW: 再完成候选人录入、职位关联、筛选、推荐和初筛闭环 | 需求: REQ-CANDIDATE-CREATE, REQ-CANDIDATE-JOB-LINK, REQ-HR-SCREEN, REQ-HIRING-MANAGER-SCREEN
- TASK-INTERVIEW-FLOW: 再完成邀约记录、面试安排和评价提交闭环 | 需求: REQ-OUTREACH-RECORD, REQ-INTERVIEW-CREATE, REQ-INTERVIEW-EVALUATION
- TASK-DECISION-FLOW: 再完成最终招聘决策、原因和历史记录 | 需求: REQ-DECISION-SUBMIT, REQ-DECISION-REASON, REQ-DECISION-AUDIT
- TASK-WORKBENCH-FLOW: 最后将上述业务状态汇总到个人工作台，并补充逾期和长期未推进识别 | 需求: REQ-DASHBOARD-PERSONAL, REQ-DASHBOARD-TODO, REQ-INTERVIEW-OVERDUE, REQ-LONG-STAGNATION

**五、产品审阅重点**

产品负责人需要重点确认：

1. 是否接受“HRM 只承接飞书职位发布后流程”的边界。
2. 是否接受一期只做人工录入、不做飞书和 Boss 直聘集成。
3. 是否接受“职位—候选人”作为核心业务关系。
4. 是否接受账号、系统角色和职位责任分开建模。
5. 是否接受推荐的候选人状态和面试评价状态。
6. 谁拥有最终招聘决策权。
7. 面试评价是否为进入招聘决策的必要条件。
8. 如何定义候选人重复、面试逾期和长期未推进。
9. 哪些用户可以查看简历、评价和招聘决策。
10. 简历和评价的保存、下载、删除及审计规则。
11. 是否将绩效管理明确排除在一期之外。
12. 首批试点具体包含哪些技术部前端职位。

**六、交付限制与未完成环节**

当前已完成：业务理解、范围建议、模块划分、主流程、角色权限方向、状态建议、异常边界、敏感数据边界、成功指标建议、可验收需求清单和产品任务拆分。

尚未完成且不应在本阶段声称完成：

- 产品负责人对关键业务选择的人工确认。
- 最终字段字典和状态机确认。
- 设计稿和交互稿。
- 研发方案、接口和数据结构。
- 测试用例执行及测试结论。
- 上线审批、部署和实际试点结果。

**实际使用的方法**

- `product-pm-create-prd`：读取其 PRD 编写方法，补齐产品目标、用户分群、价值主张、解决方案、发布范围和未决项。
- `product-requirements-handoff`：区分输入事实、已确认约束、AI 建议和待确认选择，并检查需求边界、可追溯性、异常路径、权限绕过和验收条件。
