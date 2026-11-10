import {Body, Controller, Get, Param, Post, Query, BadRequestException, ForbiddenException, NotFoundException, Inject} from '@nestjs/common';
import {DatabaseService} from './database.service.js';
import type {RecruitmentOverview, RecruitmentRole} from './recruitment.types.js';

const roles = new Set<RecruitmentRole>(['hr', 'manager', 'interviewer', 'admin']);

/** 提供首期招聘协作闭环 API；认证接入前通过 role 参数模拟当前角色。 */
@Controller('recruitment')
export class RecruitmentController {
  /** 注入数据库服务，业务写入全部通过 Prisma 事务完成。 */
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 返回按角色过滤后的职位、候选人、待办和审计时间线。 */
  @Get('overview')
  async overview(@Query('role') requestedRole = 'hr'): Promise<RecruitmentOverview> {
    const role = this.parseRole(requestedRole);
    await this.ensureSeedData();
    const users = await this.database.client.user.findMany({orderBy: {createdAt: 'asc'}});
    const currentUser = users.find((user) => user.role === role) ?? users[0];
    const position = await this.database.client.position.findFirst({include: {owner: true}, orderBy: {createdAt: 'asc'}});
    if (!position || !currentUser) throw new NotFoundException('招聘试点数据不存在');
    const candidates = await this.database.client.candidate.findMany({where: role === 'manager' ? {positionId: position.id} : undefined, include: {interviews: {include: {interviewer: true, evaluation: true}, orderBy: {round: 'asc'}}}, orderBy: {updatedAt: 'desc'}});
    const visible = candidates.filter((candidate) => role !== 'interviewer' || candidate.interviews.some((interview) => interview.interviewerId === currentUser.id));
    const activities = await this.database.client.activity.findMany({where: {candidateId: {in: visible.map((candidate) => candidate.id)}}, include: {operator: true}, orderBy: {createdAt: 'desc'}, take: 30});
    return {role, currentUser: {id: currentUser.id, name: currentUser.name, role}, position: {id: position.id, name: position.name, department: position.department, ownerName: position.owner.name}, candidates: visible.map((candidate) => this.toCandidate(candidate, role, currentUser.id)), todos: this.buildTodos(visible, role, currentUser.id), activities: activities.map((activity) => ({id: activity.id, candidateId: activity.candidateId, action: activity.action, detail: activity.detail, operatorName: activity.operator.name, createdAt: activity.createdAt.toISOString()}))};
  }

  /** 录入候选人并写入初始审计事件。 */
  @Post('candidates')
  async createCandidate(@Body() body: {name?: string; phone?: string; source?: string; summary?: string; role?: string}): Promise<{id: string}> {
    this.requireRole(body.role, 'hr');
    if (!body.name || body.name.length < 2 || body.name.length > 30 || !/^1[3-9]\d{9}$/.test(body.phone ?? '') || !body.source || !body.summary || body.summary.length < 10) throw new BadRequestException('候选人字段不完整或格式不正确');
    await this.ensureSeedData();
    const position = await this.database.client.position.findFirst({orderBy: {createdAt: 'asc'}});
    const operator = await this.database.client.user.findFirst({where: {role: 'hr'}});
    if (!position || !operator) throw new NotFoundException('招聘试点数据不存在');
    try {
      return await this.database.client.$transaction(async (tx) => {
        const candidate = await tx.candidate.create({data: {positionId: position.id, name: body.name!, phone: body.phone!, source: body.source!, summary: body.summary!, ownerId: operator.id}});
        await tx.activity.create({data: {candidateId: candidate.id, operatorId: operator.id, action: '录入候选人', detail: `来源：${body.source}`, toStatus: '待筛选'}});
        return {id: candidate.id};
      });
    } catch {
      throw new BadRequestException('同一职位下已存在该手机号的候选人');
    }
  }

  /** 执行 HR 推荐或淘汰，保持状态变更和审计事件原子提交。 */
  @Post('candidates/:id/screen')
  async screen(@Param('id') id: string, @Body() body: {result?: string; note?: string; role?: string}): Promise<void> { this.requireRole(body.role, 'hr'); await this.transition(id, body.result === '推荐' ? 'HR推荐' : '已淘汰', 'HR筛选', body.note ?? ''); }

  /** 执行用人负责人初筛。 */
  @Post('candidates/:id/manager-screen')
  async managerScreen(@Param('id') id: string, @Body() body: {result?: string; note?: string; role?: string}): Promise<void> { this.requireRole(body.role, 'manager'); await this.transition(id, body.result === '通过' ? '负责人初筛' : '已淘汰', '负责人初筛', body.note ?? ''); }

  /** 记录邀约结果并在接受时创建首轮面试任务。 */
  @Post('candidates/:id/interviews')
  async arrangeInterview(@Param('id') id: string, @Body() body: {scheduledAt?: string; interviewerId?: string; note?: string; role?: string}): Promise<void> {
    this.requireRole(body.role, 'hr');
    if (!body.scheduledAt || Number.isNaN(new Date(body.scheduledAt).getTime()) || !body.interviewerId) throw new BadRequestException('面试时间和面试官不能为空');
    const hr = await this.database.client.user.findFirst({where: {role: 'hr'}});
    const interviewer = await this.database.client.user.findFirst({where: {id: body.interviewerId === 'interviewer' ? undefined : body.interviewerId, role: 'interviewer'}});
    const candidate = await this.database.client.candidate.findUnique({where: {id}, include: {interviews: true}});
    if (!candidate || !hr || !interviewer) throw new NotFoundException('候选人或面试官不存在');
    await this.database.client.$transaction(async (tx) => { await tx.candidate.update({where: {id}, data: {status: '面试中'}}); await tx.interview.create({data: {candidateId: id, round: candidate.interviews.length + 1, title: `技术${candidate.interviews.length + 1}面`, scheduledAt: new Date(body.scheduledAt!), interviewerId: interviewer.id, status: '待评价'}}); await tx.activity.create({data: {candidateId: id, operatorId: hr.id, action: '安排面试', detail: body.note ?? '已记录外部邀约并接受'}}); });
  }

  /** 由被分配的面试官提交一次不可修改的结构化评价。 */
  @Post('interviews/:id/evaluation')
  async evaluate(@Param('id') id: string, @Body() body: {result?: string; score?: number; strength?: string; risk?: string; role?: string}): Promise<void> {
    this.requireRole(body.role, 'interviewer');
    if (!body.result || !body.score || body.score < 1 || body.score > 5 || !body.strength || !body.risk) throw new BadRequestException('评价字段不完整');
    const interviewer = await this.database.client.user.findFirst({where: {role: 'interviewer'}});
    const interview = await this.database.client.interview.findUnique({where: {id}, include: {candidate: true}});
    if (!interviewer || !interview || interview.interviewerId !== interviewer.id || interview.status !== '待评价') throw new ForbiddenException('当前角色无权评价该面试');
    await this.database.client.$transaction(async (tx) => { await tx.evaluation.create({data: {interviewId: id, result: body.result!, score: Number(body.score), strength: body.strength!, risk: body.risk!, operator: interviewer.name}}); const remaining = await tx.interview.count({where: {candidateId: interview.candidateId, status: '待评价', id: {not: id}}}); await tx.interview.update({where: {id}, data: {status: '已评价'}}); if (remaining === 0) await tx.candidate.update({where: {id: interview.candidateId}, data: {status: '待决策'}}); await tx.activity.create({data: {candidateId: interview.candidateId, operatorId: interviewer.id, action: '提交面试评价', detail: `${interview.title} · ${body.result}`}}); });
  }

  /** 提交 HR 最终录用、淘汰或继续面试决策。 */
  @Post('candidates/:id/decision')
  async decide(@Param('id') id: string, @Body() body: {result?: string; note?: string; role?: string}): Promise<void> { this.requireRole(body.role, 'hr'); if (!body.result || !body.note) throw new BadRequestException('最终决策必须填写结果和备注'); await this.transition(id, body.result === '录用' ? '已录用' : body.result === '淘汰' ? '已淘汰' : '面试中', '最终决策', body.note); }

  /** 解析并校验模拟角色，未知角色默认拒绝。 */
  private parseRole(value: string): RecruitmentRole { if (!roles.has(value as RecruitmentRole)) throw new BadRequestException('角色无效'); return value as RecruitmentRole; }

  /** 校验接口调用角色是否与业务能力匹配。 */
  private requireRole(value: string | undefined, expected: RecruitmentRole): void { if (this.parseRole(value ?? '') !== expected) throw new ForbiddenException('当前角色无权执行此操作'); }

  /** 执行状态变更并追加筛选/决策记录。 */
  private async transition(id: string, status: string, action: string, detail: string): Promise<void> { const operator = await this.database.client.user.findFirst({where: {role: action === '负责人初筛' ? 'manager' : 'hr'}}); const candidate = await this.database.client.candidate.findUnique({where: {id}}); if (!operator || !candidate) throw new NotFoundException('候选人不存在'); await this.database.client.$transaction(async (tx) => { if (action.includes('筛选')) await tx.screening.create({data: {candidateId: id, operator: operator.name, type: action, result: status === '已淘汰' ? '不通过' : '通过', note: detail || '已提交筛选结论'}}); await tx.candidate.update({where: {id}, data: {status}}); await tx.activity.create({data: {candidateId: id, operatorId: operator.id, action, detail: detail || '状态已更新', fromStatus: candidate.status, toStatus: status}}); }); }

  /** 首次访问时写入合成职位、角色和候选人，保证本地体验可直接运行。 */
  private async ensureSeedData(): Promise<void> { if (await this.database.client.position.count() > 0) return; const users = await Promise.all([{name: '林晓', role: 'hr'}, {name: '周远', role: 'manager'}, {name: '陈屿', role: 'interviewer'}, {name: '管理员', role: 'admin'}].map((user) => this.database.client.user.create({data: user}))); const position = await this.database.client.position.create({data: {code: 'FE-2026', name: '前端工程师', department: '技术部', ownerId: users[1].id}}); const candidate = await this.database.client.candidate.create({data: {positionId: position.id, name: '张晨', phone: '13800138000', source: 'Boss直聘', summary: '5年前端经验，熟悉 React、TypeScript 和性能优化。', ownerId: users[0].id}}); await this.database.client.activity.create({data: {candidateId: candidate.id, operatorId: users[0].id, action: '录入候选人', detail: '合成演示数据', toStatus: '待筛选'}}); }

  /** 将 Prisma 候选人转换为按角色脱敏的业务读模型。 */
  private toCandidate(candidate: any, role: RecruitmentRole, currentUserId: string): any { return {id: candidate.id, name: candidate.name, phone: role === 'hr' || role === 'admin' ? candidate.phone : `${candidate.phone.slice(0, 3)}****${candidate.phone.slice(-4)}`, source: candidate.source, summary: candidate.summary, status: candidate.status, updatedAt: candidate.updatedAt.toISOString(), interviews: candidate.interviews.filter((interview: any) => role !== 'interviewer' || interview.interviewerId === currentUserId).map((interview: any) => ({id: interview.id, round: interview.round, title: interview.title, scheduledAt: interview.scheduledAt.toISOString(), interviewerName: interview.interviewer.name, status: interview.status, evaluation: interview.evaluation ? {result: interview.evaluation.result, score: interview.evaluation.score, strength: interview.evaluation.strength, risk: interview.evaluation.risk} : undefined}))}; }

  /** 根据当前角色和候选状态计算待办，不引入未确认的自动催办。 */
  private buildTodos(candidates: any[], role: RecruitmentRole, currentUserId: string): Array<{candidateId: string; candidateName: string; label: string; status: string}> { return candidates.flatMap((candidate) => { const items = []; if (role === 'hr' && candidate.status === '待筛选') items.push({candidateId: candidate.id, candidateName: candidate.name, label: '待我筛选', status: candidate.status}); if (role === 'manager' && candidate.status === 'HR推荐') items.push({candidateId: candidate.id, candidateName: candidate.name, label: '待我初筛', status: candidate.status}); if (role === 'hr' && candidate.status === '负责人初筛') items.push({candidateId: candidate.id, candidateName: candidate.name, label: '待我邀约', status: candidate.status}); if (role === 'interviewer' && candidate.interviews.some((interview: any) => interview.interviewerId === currentUserId && interview.status === '待评价')) items.push({candidateId: candidate.id, candidateName: candidate.name, label: '待我评价', status: candidate.status}); return items; }); }
}
