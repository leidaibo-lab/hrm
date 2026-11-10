/** 招聘工作台支持的模拟角色；正式认证接入前由请求参数显式传入。 */
export type RecruitmentRole = 'hr' | 'manager' | 'interviewer' | 'admin';

/** 统一描述招聘工作台读模型，避免前端依赖 Prisma 内部类型。 */
export interface RecruitmentOverview {
  role: RecruitmentRole;
  currentUser: {id: string; name: string; role: RecruitmentRole};
  position: {id: string; name: string; department: string; ownerName: string};
  candidates: RecruitmentCandidate[];
  todos: RecruitmentTodo[];
  activities: RecruitmentActivity[];
}

/** 候选人详情及其面试任务的稳定展示结构。 */
export interface RecruitmentCandidate {
  id: string;
  name: string;
  phone: string;
  source: string;
  summary: string;
  status: string;
  updatedAt: string;
  interviews: RecruitmentInterview[];
}

/** 面试任务只暴露当前角色需要的必要信息。 */
export interface RecruitmentInterview {
  id: string;
  round: number;
  title: string;
  scheduledAt: string;
  interviewerName: string;
  status: string;
  evaluation?: {result: string; score: number; strength: string; risk: string};
}

/** 工作台中由角色筛选后的待办事项。 */
export interface RecruitmentTodo {
  candidateId: string;
  candidateName: string;
  label: string;
  status: string;
}

/** 最近活动时间线的脱敏展示结构。 */
export interface RecruitmentActivity {
  id: string;
  candidateId: string;
  action: string;
  detail: string;
  operatorName: string;
  createdAt: string;
}
