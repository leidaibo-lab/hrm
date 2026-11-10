import assert from 'node:assert/strict';

const base = process.env.HRM_API_BASE_URL ?? 'http://127.0.0.1:3001/api';

/** 请求招聘 API 并在非 2xx 时保留服务端诊断。 */
async function request(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {method, headers: body ? {'content-type': 'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined});
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

const phone = `137${Date.now().toString().slice(-8)}`;
const created = await request('/recruitment/candidates', 'POST', {role: 'hr', name: 'Smoke候选人', phone, source: '内推', summary: '用于招聘闭环 smoke 的合成候选人资料。'});
await request(`/recruitment/candidates/${created.id}/screen`, 'POST', {role: 'hr', result: '推荐', note: 'smoke 推荐'});
await request(`/recruitment/candidates/${created.id}/manager-screen`, 'POST', {role: 'manager', result: '通过', note: 'smoke 初筛通过'});
await request(`/recruitment/candidates/${created.id}/interviews`, 'POST', {role: 'hr', scheduledAt: new Date(Date.now() + 86400000).toISOString(), interviewerId: 'interviewer', note: 'smoke 面试安排'});
const interviewerView = await request('/recruitment/overview?role=interviewer');
const interview = interviewerView.candidates.find((candidate) => candidate.id === created.id)?.interviews[0];
assert.ok(interview, '面试任务未出现在面试官视图');
await request(`/recruitment/interviews/${interview.id}/evaluation`, 'POST', {role: 'interviewer', result: '通过', score: 5, strength: '基础扎实', risk: '继续观察协作'});
await request(`/recruitment/candidates/${created.id}/decision`, 'POST', {role: 'hr', result: '录用', note: 'smoke 录用'});
const finalView = await request('/recruitment/overview?role=hr');
const finalCandidate = finalView.candidates.find((candidate) => candidate.id === created.id);
assert.equal(finalCandidate?.status, '已录用');
console.log(`招聘闭环 smoke 通过：${created.id} -> 已录用`);
