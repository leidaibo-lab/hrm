import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(process.cwd(), '../..');
const PRD = join(REPO_ROOT, 'docs/prd/agentic');
const FEATURES = [
  '01-source.md',
  '02-triage.md',
  '03-ticket.md',
  '04-gate.md',
  '05-artifact.md',
  '06-console.md',
];

describe('PRD 目标结构与总体设计一致', () => {
  const design = readFileSync(join(PRD, 'design.md'), 'utf8');

  it('设计篇包含完整章节', () => {
    for (const heading of [
      '## 二、总体架构与 Super-agent 运行模型',
      '## 三、领域模型',
      '## 四、端到端数据流',
      '## 五、技术方案',
      '## 六、文件结构与模块职责',
      '## 七、数据模型',
      '## 八、接口与契约',
      '## 九、扩展与接入',
      '## 十、部署与运维',
      '## 十一、设计边界、风险与待决项',
    ]) {
      expect(design.includes(heading), heading).toBe(true);
    }
  });

  it('设计篇声明核心目录与组件', () => {
    for (const token of [
      'modules/agentic/',
      'domain/',
      'application/',
      'infrastructure/',
      'sources/',
      'executor/',
      'agents/',
      'session/',
      'workspace/',
      'channels/',
    ]) {
      expect(design.includes(token), token).toBe(true);
    }
  });

  it('业务域文档齐全且含 A/B 段', () => {
    for (const feature of FEATURES) {
      const path = join(PRD, feature);
      expect(existsSync(path), feature).toBe(true);
      const markdown = readFileSync(path, 'utf8');
      expect(markdown.includes('## 二、产品规格（A）'), feature).toBe(true);
      expect(markdown.includes('## 三、技术设计（B）'), feature).toBe(true);
    }
  });
});
