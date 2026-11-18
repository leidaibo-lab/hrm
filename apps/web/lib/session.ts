import { type Session, sessionSchema } from '@cip/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

export type { Session };

/**
 * 会话唯一接缝：sid cookie → api /me → sessionSchema.parse。
 * 401 重定向登录页；其余非 2xx 抛出（问题详情随异常上抛，由错误边界兜底）。
 * RSC 专用：服务端到服务端请求手动转发 cookie 串，且必须禁缓存（每用户数据）。
 * 调用方（workspace layout 与 admin 页面）声明 `instant = false` 阻塞渲染（cacheComponents）。
 */
export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/me`,
    {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    },
  );
  if (response.status === 401) {
    redirect('/login');
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(
      `会话获取失败（${response.status}）: ${problem?.detail ?? '无详情'}`,
    );
  }
  return sessionSchema.parse(await response.json());
}
