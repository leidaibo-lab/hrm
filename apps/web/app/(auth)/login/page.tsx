import { SESSION_COOKIE_NAME } from '@cip/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth';

/**
 * 登录页；已持有会话 cookie 的访问乐观跳转工作台（真伪由 api 校验）。
 * 整页依赖会话存在性，阻塞渲染（cacheComponents）。
 */
export const instant = false;

export default async function LoginPage() {
  const cookieStore = await cookies();
  if (cookieStore.has(SESSION_COOKIE_NAME)) {
    redirect('/');
  }
  return <LoginForm />;
}
