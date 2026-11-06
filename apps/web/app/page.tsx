 'use client';

import {useState} from 'react';

/** 展示环境边界并通过同源代理检查真实API与数据库就绪状态。 */
export default function Home() {
  const [status, setStatus] = useState('尚未检查');
  const [checking, setChecking] = useState(false);

  /** 只有API返回预期固定结构时才报告就绪，失败允许用户重试。 */
  async function checkReadiness(): Promise<void> {
    if (checking) return;
    setChecking(true);
    try {
      const response = await fetch('/api/health/ready', {cache: 'no-store', signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('not-ready');
      const data: unknown = await response.json();
      if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok' || !('database' in data) || data.database !== 'ok') throw new Error('invalid-health');
      setStatus('API 与数据库已就绪');
    } catch {
      setStatus('服务尚未就绪，请检查容器日志后重试');
    } finally { setChecking(false); }
  }

  return <main>
    <p className="eyebrow">HRM · 开发环境</p>
    <h1>业务从这里开始</h1>
    <p>Next.js、NestJS 与 PostgreSQL 已纳入同一个 pnpm workspace。招聘业务功能将在产品需求确认后开发。</p>
    <section aria-labelledby="readiness-title" aria-busy={checking}>
      <h2 id="readiness-title">环境就绪检查</h2>
      <p role="status" aria-live="polite">{status}</p>
      <button disabled={checking} onClick={checkReadiness}>{checking ? '检查中…' : '检查 API 与数据库'}</button>
    </section>
  </main>;
}
